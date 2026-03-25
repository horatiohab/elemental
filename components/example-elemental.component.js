import { Elemental } from '../elemental.js';

class ExampleElementalComponent extends Elemental {
    static template = /*html*/`
        <h1><bind>title</bind></h1>

        <!-- Bind with expression (ternary) -->
        <p><bind>todos.length === 0 ? 'No todos yet' : 'You have ' + todos.length + ' todo(s)'</bind></p>

        <!-- For loop with class binding and event handler -->
        <div class="todos-list">
            <for each="todos" as="todo">
                <div 
                    class="todo-item"
                    data-class="{ 'todo-done': todo.done }"
                    data-click="toggleTodo(todo.id)"
                >
                    <span><bind>todo.text</bind></span>
                </div>
            </for>
        </div>

        <!-- If conditional rendering -->
        <if condition="todos.length > 0">
            <button type="button" data-click="clearCompleted()">Clear completed</button>
        </if>

        <!-- Event handler for adding -->
        <button type="button" class="btn-add" data-click="addTodo()">
            <bind>todos.length >= 5 ? 'Max todos reached' : 'Add todo'</bind>
        </button>
    `;

    static defaultProps() {
        return {
            title: 'Todo App',
            todos: [
                { id: 1, text: 'Learn Elemental', done: false },
                { id: 2, text: 'Build a component', done: true },
                { id: 3, text: 'Deploy it', done: false },
            ],
        };
    }

    toggleTodo(id) {
        this.setState((prev) => ({
            ...prev,
            todos: prev.todos.map(t =>
                t.id === id ? { ...t, done: !t.done } : t
            ),
        }));
    }

    clearCompleted() {
        this.setState((prev) => ({
            ...prev,
            todos: prev.todos.filter(t => !t.done),
        }));
    }

    addTodo() {
        if (this.props.todos.length < 5) {
            this.setState((prev) => ({
                ...prev,
                todos: [
                    ...prev.todos,
                    { id: Date.now(), text: `Todo ${prev.todos.length + 1}`, done: false },
                ],
            }));
        }
    }

    static styles = /*css*/`
        h1 {
            color: #333;
            margin-bottom: 1rem;
        }

        p {
            color: #666;
            font-size: 0.95rem;
            margin-bottom: 1.5rem;
        }

        .todos-list {
            list-style: none;
            margin-bottom: 1.5rem;
        }

        .todo-item {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background: #f5f5f5;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .todo-item:hover {
            background: #eee;
        }

        .todo-item.todo-done {
            opacity: 0.6;
            text-decoration: line-through;
            color: #999;
        }

        button {
            padding: 0.5rem 1rem;
            margin-right: 0.5rem;
            font-size: 0.95rem;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
        }

        button:hover {
            background: #f9f9f9;
            border-color: #999;
        }

        .btn-add {
            background: #4CAF50;
            color: white;
            border: none;
        }

        .btn-add:hover {
            background: #45a049;
        }
    `;
}

customElements.define('example-elemental-component', ExampleElementalComponent);