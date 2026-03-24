# Elemental

Elemental is a lightweight base class for building reactive [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components). It gives you a declarative HTML template syntax, scoped styles, and simple prop-based state management. No build tools or dependencies required.

---

## Getting Started

Import `Elemental` and extend it to create a component:

```js
import { Elemental } from './elemental.js';

class MyCounter extends Elemental {
    static template = html`
        <p>Count: <bind>count</bind></p>
        <button type="button" data-click="increment()">+1</button>
    `;

    static defaultProps() {
        return { count: 0 };
    }

    increment() {
        this.setState(prev => ({ ...prev, count: prev.count + 1 }));
    }
}

customElements.define('my-counter', MyCounter);
```

Then use it in HTML:

```html
<script type="module" src="./my-counter.js"></script>

<my-counter></my-counter>
```

---

## Templates

Templates are plain HTML strings declared as `static template`. So far there are three built-in directives control rendering:

### `<bind>`

Outputs the value of a prop by name. Supports dot-notation for nested values.

```html
<p><bind>user.name</bind></p>
```

### `<for>`

Loops over an array prop and renders children for each item. Use `each` to name the array and `as` to name the loop variable. Loops can be nested.

```html
<for each="items" as="item">
    <p><bind>item.label</bind></p>
</for>
```

### `<if>`

Conditionally renders its children.

```html
<if condition="items.length === 0">
    <p>Nothing here yet.</p>
</if>
```

---

## Props & State

Props are the component's reactive state. On first render, `defaultProps` is called to set the initial values. The return value can read HTML attributes via `this.getAttribute()`.

```js
static defaultProps() {
    return {
        title: this.getAttribute('title') || 'Untitled',
        items: [],
    };
}
```

To update state, call `setState()` with either a new object or an updater function:

```js
// Updater function (receives current props)
this.setState(prev => ({ ...prev, count: prev.count + 1 }));

// Object (replaces props entirely)
this.setState({ count: 0 });
```

Any change to props automatically re-renders the component.

---

## Events

Attach event handlers to elements using `data-<event>="handlerName()"` attributes.

```html
<button type="button" data-click="handleClick()">Click me</button>
<input data-input="handleInput()" />
<form data-submit="handleSubmit()"></form>
```

```js
handleClick() {
    // called when the button is clicked
}
```

> Note: for now, handlers currently receive no arguments. Access `this.props` directly inside the handler for current state.

---

## Styles

Declare scoped CSS as `static styles`. Styles are applied via [Constructable Stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet) and are fully encapsulated inside the component's Shadow DOM.

```js
static styles = css`
    p { color: steelblue; }
    button { font-size: 1rem; }
`;
```

---

## Full Example

See [components/example-elemental.component.js](components/example-elemental.component.js) and [index.html](index.html) for a working example with nested loops, conditional rendering, and event handling.
