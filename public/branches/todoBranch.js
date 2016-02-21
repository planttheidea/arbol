import singulum from '../../src';

const addTodo = (todos = [], value) => {
    return [
        ...todos,
        {
            id: todos.length.toString(),
            value
        }
    ];
};

const editTodo = (todos = [], id, value) => {
    const index = todos.findIndex((item) => {
        return item.id === id;
    });

    return [
        ...todos.slice(0, index),
        {
            ...todos[index],
            value
        },
        ...todos.slice(index + 1, todos.length)
    ];
};

const removeTodo = (todos = [], id) => {
    const index = todos.findIndex((item) => {
        return item.id === id;
    });

    return [
        ...todos.slice(0, index),
        ...todos.slice(index + 1, todos.length)
    ];
};

export default singulum.branch('todoBranch', {
    todos: {
        addTodo,
        editTodo,
        removeTodo,
        initialValue: []
    }
});