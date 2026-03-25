const SUPPORTED_EVENTS = ['click', 'change', 'input', 'submit'];
const HANDLER_CALL_PATTERN = /^([\w$]+)\((.*)\)$/;
const UNRESOLVED = Symbol('UNRESOLVED');

export class Elemental extends HTMLElement {
    #props = {};
    #proxyCache = new WeakMap();
    #isRendering = false;
    #renderQueued = false;

    constructor({ template, styles, props } = {}) {
        super();
        this.attachShadow({ mode: 'open' });

        const componentClass = this.constructor;
        const defaultProps = typeof componentClass.defaultProps === 'function'
            ? componentClass.defaultProps.call(this)
            : (componentClass.defaultProps ?? {});

        this.template = template ?? componentClass.template ?? null;
        this.styles = styles ?? componentClass.styles ?? '';

        Object.defineProperty(this, 'props', {
            get: () => this.#props,
            set: (nextProps) => this.#setProps(nextProps),
        });

        this.props = { ...(defaultProps || {}), ...(props || {}) };
        this.#initialiseStyles(this.styles);
    }

    connectedCallback() {
        this.#renderNow();
    }

    #setProps(nextProps) {
        this.#props = this.#makeReactive(nextProps || {});
        this.#requestRender();
    }

    #initialiseStyles(styles) {
        if (!styles) return;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(styles);
        this.shadowRoot.adoptedStyleSheets = [sheet];
    }

    #buildTemplate(templateNodes, scope = this.props) {
        const outputFragment = document.createDocumentFragment();

        for (const sourceNode of templateNodes) {
            if (sourceNode.nodeType === Node.TEXT_NODE) {
                outputFragment.append(document.createTextNode(sourceNode.textContent));
                continue;
            }

            const directiveTag = sourceNode.tagName?.toLowerCase();

            if (directiveTag === 'bind') {
                const bindValue = this.#resolveBindValue(sourceNode.textContent, scope);
                outputFragment.append(document.createTextNode(bindValue));
                continue;
            }

            if (directiveTag === 'for') {
                const items = this.#resolvePath(sourceNode.getAttribute('each'), scope);
                const as = sourceNode.getAttribute('as');
                if (!Array.isArray(items)) {
                    continue;
                }

                items.forEach(item => {
                    const childScope = Object.create(scope);
                    childScope[as] = item;
                    outputFragment.append(this.#buildTemplate(Array.from(sourceNode.childNodes), childScope));
                });
                continue;
            }

            if (directiveTag === 'if' && !this.#evaluateCondition(sourceNode.getAttribute('condition'), scope)) {
                continue;
            }

            const renderedNode = sourceNode.cloneNode(false);
            if (sourceNode.childNodes.length) {
                renderedNode.append(this.#buildTemplate(Array.from(sourceNode.childNodes), scope));
            }

            this.#applyDirectives(sourceNode, renderedNode, scope);

            outputFragment.append(renderedNode);
        }

        return outputFragment;
    }

    #applyDirectives(sourceNode, renderedNode, scope = this.props) {
        if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        this.#applyEventDirectives(sourceNode, renderedNode, scope);
        this.#applyClassDirective(sourceNode, renderedNode, scope);
    }

    #applyEventDirectives(sourceNode, renderedNode, scope) {
        for (const eventName of SUPPORTED_EVENTS) {
            const directive = sourceNode.getAttribute(`data-${eventName}`);
            if (!directive) continue;

            const match = directive.match(HANDLER_CALL_PATTERN);
            if (!match) {
                this.#warn('Invalid event directive format:', directive);
                continue;
            }

            const handlerName = match[1];
            const rawArgs = match[2]?.trim();
            const handler = this.#getEventHandlerByName(handlerName);
            if (!handler) continue;

            renderedNode.addEventListener(eventName, (event) => {
                const args = rawArgs
                    ? this.#evaluateExpression(`[${rawArgs}]`, scope, [], event)
                    : [];

                if (!Array.isArray(args)) {
                    this.#warn('Invalid event directive arguments:', directive);
                    return;
                }

                handler.call(this, ...args);
            });
        }
    }

    #applyClassDirective(sourceNode, renderedNode, scope) {
        const classBinding = sourceNode.getAttribute('data-class');
        if (!classBinding) return;

        const classMap = this.#parseClassMap(classBinding, scope);
        if (!classMap) {
            this.#warn('Invalid data-class binding:', classBinding);
            return;
        }

        for (const [className, condition] of Object.entries(classMap)) {
            const shouldAdd = typeof condition === 'string'
                ? this.#evaluateCondition(condition, scope)
                : !!condition;
            if (shouldAdd) {
                renderedNode.classList.add(className);
            }
        }
    }

    #parseClassMap(binding, scope) {
        const parsedJson = this.#safeParseJson(binding);
        const candidate = parsedJson !== UNRESOLVED
            ? parsedJson
            : this.#evaluateExpression(binding, scope, null);

        return this.#isPlainObject(candidate) ? candidate : null;
    }

    #safeParseJson(value) {
        try {
            return JSON.parse(value);
        } catch {
            return UNRESOLVED;
        }
    }

    #getEventHandlerByName(handlerName) {
        if (!handlerName) return null;
        if (typeof this[handlerName] === 'function') return this[handlerName];
        const propHandler = this.props?.[handlerName];
        return typeof propHandler === 'function' ? propHandler : null;
    }

    #makeReactive(value) {
        if (!value || typeof value !== 'object') return value;
        const cached = this.#proxyCache.get(value);
        if (cached) return cached;

        const proxy = new Proxy(value, {
            get: (target, key, receiver) => this.#makeReactive(Reflect.get(target, key, receiver)),
            set: (target, key, newValue, receiver) => {
                const currentValue = Reflect.get(target, key, receiver);
                const result = Reflect.set(target, key, newValue, receiver);
                if (currentValue !== newValue) this.#requestRender();
                return result;
            },
            deleteProperty: (target, key) => {
                const result = Reflect.deleteProperty(target, key);
                this.#requestRender();
                return result;
            },
        });

        this.#proxyCache.set(value, proxy);
        return proxy;
    }

    #requestRender() {
        if (!this.isConnected || this.#isRendering || this.#renderQueued) return;
        this.#renderQueued = true;
        queueMicrotask(() => {
            this.#renderQueued = false;
            this.#renderNow();
        });
    }

    requestUpdate() {
        this.#requestRender();
    }

    setState(updater) {
        const isFunction = typeof updater === 'function';
        const isObject = updater && typeof updater === 'object';
        if (!isFunction && !isObject) {
            if (this.#isDevelopment()) {
                throw new TypeError('setState(updater) expects a function or object.');
            }
            return;
        }

        const nextState = isFunction ? updater(this.props) : updater;
        const isValidState = Array.isArray(nextState) || this.#isPlainObject(nextState);
        if (!isValidState) {
            if (this.#isDevelopment()) {
                throw new TypeError('setState(updater) must resolve to a plain object or array state.');
            }
            return;
        }

        this.props = nextState === this.props ? { ...this.props } : nextState;
    }

    #isDevelopment() {
        return globalThis.process?.env?.NODE_ENV !== 'production';
    }

    #isPlainObject(value) {
        return !!value && Object.getPrototypeOf(value) === Object.prototype;
    }

    #resolveBindValue(expression, scope = this.props) {
        const result = this.#evaluateExpression(expression, scope, UNRESOLVED);
        if (result !== UNRESOLVED) {
            return String(result ?? '');
        }

        const pathResult = this.#resolvePath(expression, scope);
        return String(pathResult ?? '');
    }

    #resolvePath(path, scope = this.props) {
        if (!path) return '';
        const keys = path.split('.').map((key) => key.trim()).filter(Boolean);
        if (!keys.length) return '';
        return keys.reduce((obj, key) => obj?.[key], scope) ?? '';
    }

    #evaluateCondition(condition, scope = this.props) {
        return !!this.#evaluateExpression(condition, scope, false);
    }

    #evaluateExpression(expression, scope = this.props, fallback = undefined, event = undefined) {
        try {
            return new Function('scope', 'event', `with (scope) { return (${expression}); }`)(scope, event);
        } catch {
            return fallback;
        }
    }

    #warn(...args) {
        if (!this.#isDevelopment()) return;
        console.warn(...args);
    }

    #renderNow() {
        if (!this.template) return;
        this.#isRendering = true;
        try {
            const templateElement = document.createElement('template');
            templateElement.innerHTML = this.template.trim();
            const templateNodes = Array.from(templateElement.content.childNodes);
            this.shadowRoot.replaceChildren(this.#buildTemplate(templateNodes, this.props));
        } finally {
            this.#isRendering = false;
        }
    }

    render() {
        this.#requestRender();
    }
}