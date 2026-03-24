const SUPPORTED_EVENTS = ['click', 'change', 'input', 'submit'];
const ZERO_ARG_HANDLER_PATTERN = /^([\w$]+)\(\)$/;

export class Elemental extends HTMLElement {
    #props = {};
    #proxyCache = new WeakMap();
    #isRendering = false;
    #renderQueued = false;
    #hasWarnedAboutRender = false;

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
                outputFragment.append(document.createTextNode(this.#getValueAtPath(sourceNode.textContent, scope)));
                continue;
            }

            if (directiveTag === 'for') {
                const items = this.#getValueAtPath(sourceNode.getAttribute('each'), scope);
                const as = sourceNode.getAttribute('as');
                items?.forEach(item => {
                    const childScope = Object.create(scope);
                    childScope[as] = item;
                    outputFragment.append(this.#buildTemplate(Array.from(sourceNode.childNodes), childScope));
                });
                continue;
            }

            if (directiveTag === 'if' && !this.#evaluateConditionExpression(sourceNode.getAttribute('condition'), scope)) {
                continue;
            }

            const renderedNode = sourceNode.cloneNode(false);
            if (sourceNode.childNodes.length) {
                renderedNode.append(this.#buildTemplate(Array.from(sourceNode.childNodes), scope));
            }

            this.#attachDirectiveEvents(sourceNode, renderedNode);

            outputFragment.append(renderedNode);
        }

        return outputFragment;
    }

    #attachDirectiveEvents(sourceNode, renderedNode) {
        for (const eventName of SUPPORTED_EVENTS) {
            const handlerName = sourceNode.getAttribute(`data-${eventName}`)?.match(ZERO_ARG_HANDLER_PATTERN)?.[1];
            const handler = this.#getEventHandlerByName(handlerName);
            if (handler) {
                renderedNode.addEventListener(eventName, () => handler.call(this));
            }
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

    #getValueAtPath(path, scope = this.props) {
        if (!path) return '';
        return path.split('.').reduce((obj, key) => obj?.[key], scope) ?? '';
    }

    #evaluateConditionExpression(condition, scope = this.props) {
        try {
            return new Function('scope', `with (scope) { return ${condition}; }`)(scope);
        } catch {
            return false;
        }
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
        if (this.#isDevelopment() && !this.#hasWarnedAboutRender) {
            this.#hasWarnedAboutRender = true;
            console.warn('Elemental.render() is for internal compatibility. Prefer setState(...) or requestUpdate().');
        }
        this.requestUpdate();
    }
}