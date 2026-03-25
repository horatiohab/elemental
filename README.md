# Elemental

Elemental is a lightweight base class for building reactive [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components). 

It gives you:

- HTML templates
- reactive state
- scoped styles
- simple event directives

No build tools or extra packages are required.

## Quick Start

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
        this.setState((prev) => ({ ...prev, count: prev.count + 1 }));
    }
}

customElements.define('my-counter', MyCounter);
```

Then use it in HTML:

```html
<script type="module" src="./my-counter.js"></script>

<my-counter></my-counter>
```

## Template Directives

### bind

Use bind to print a value or expression.

```html
<!-- Property access -->
<p><bind>user.name</bind></p>

<!-- Ternary expression -->
<p><bind>isLoading ? 'Loading...' : 'Done'</bind></p>

<!-- Boolean expressions -->
<p><bind>items.length > 0 ? items.length + ' items' : 'No items'</bind></p>

<!-- Arithmetic -->
<p>Total: <bind>price * quantity</bind></p>
```

### for

Use for to loop through an array.

```html
<for each="items" as="item">
    <p><bind>item.label</bind></p>
</for>
```

### if

Use if to render content only when a condition is true.

```html
<if condition="items.length === 0">
    <p>Nothing here yet.</p>
</if>
```

## State

State lives in props.

Set initial state with defaultProps:

```js
static defaultProps() {
    return {
        title: this.getAttribute('title') || 'Untitled',
        items: [],
    };
}
```

Update state with setState:

```js
// Updater function (receives current props)
this.setState(prev => ({ ...prev, count: prev.count + 1 }));

// Object (replaces props entirely)
this.setState({ count: 0 });
```

## Events

Attach event handlers to elements using `data-<event>="handlerName(...)"` attributes.

```html
<button data-click="handleClick()">Click</button>
<button data-click="selectItem(item.id)">Select</button>
<button data-click="selectItem(event, item.id)">Select with event</button>
```

## Class Binding

Use data-class to toggle classes from state.

```html
<button data-class="{ active: isSelected, disabled: isLoading }">
    Save
</button>
```

You can also use quoted class names:

```html
<div data-class="{ 'error-message': hasError }">Message</div>
```

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

See [components/example-elemental.component.js](components/example-elemental.component.js) and [index.html](index.html) for a working example.
