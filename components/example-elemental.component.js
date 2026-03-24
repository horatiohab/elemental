import { Elemental } from '../elemental.js';

class ExampleElementalComponent extends Elemental {
    static template = /*html*/`
        <h2><bind>title</bind></h2>

        <for each="items" as="item">
            <p><bind>item.text</bind></p>
        </for>

        <div>
            <for each="nestedItems" as="nestedItem">
                <p><bind>nestedItem.text</bind></p>
                <div>
                    <for each="nestedItem.subItems" as="subItem">
                        <p><bind>subItem.text</bind></p>
                    </for>
                </div>
            </for>
        </div>


        <if condition="items.length === 0">
            <p>No items to display.</p>
        </if>

        <button type="button" id="addItemButton" data-click="handleAddItem()">Add item</button>
    `;

    static defaultProps() {
        return {
            title: this.getAttribute('title') || 'Default',
            items: [
                { id: 1, text: 'Item 1' },
                { id: 2, text: 'Item 2' },
                { id: 3, text: 'Item 3' },
            ],
            nestedItems: [
                { id: 1, text: 'Nested Item 1', subItems: [{ id: 1, text: 'Sub Item 1' }, { id: 2, text: 'Sub Item 2' }] },
                { id: 2, text: 'Nested Item 2', subItems: [{ id: 3, text: 'Sub Item 3' }] },
            ],
        };
    }

    handleAddItem() {
        this.setState((prev) => {
            const nextItemNumber = prev.items.length + 1;
            console.log('Adding item', nextItemNumber);
            return {
                ...prev,
                items: [...prev.items, { id: nextItemNumber, text: `Item ${nextItemNumber}` }],
            };
        });
    }


    static styles = /*css*/`
        p {
            color: blue;
        }
    `;
}

customElements.define('example-elemental-component', ExampleElementalComponent);