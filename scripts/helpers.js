// Helper functions for DOM manipulation and event handling

/**
 * Resolves a DOM element based on the provided selector.
 *
 * @param {HTMLElement|NodeList|DocumentFragment|string|any} selector - The selector to resolve. 
 *        Can be an HTMLElement, a string (CSS selector), null, or undefined.
 * @returns {HTMLElement|null} - The resolved HTMLElement if found, or null if the selector is invalid or no element matches.
 */
function resolveElement(selector) {
    if (!selector || typeof selector === "undefined") {
        return null;
    }
    if (selector instanceof HTMLElement) {
        return selector;
    } else if (selector instanceof NodeList) {
        if (selector.length > 0) {
            // Return the first element in the NodeList that is a HTMLElement
            for (let i = 0; i < selector.length; i++) {
                if (selector[i] instanceof HTMLElement) {
                    return selector[i];
                }
            }
        }
    } else if (selector instanceof DocumentFragment) {
        if (selector.childNodes && selector.childNodes.length > 0) {
            // Return the first child node of the DocumentFragment that is a HTMLElement
            for (let i = 0; i < selector.childNodes.length; i++) {
                if (selector.childNodes[i] instanceof HTMLElement) {
                    return selector.childNodes[i];
                }
            }
        }
    } else if (typeof selector === "string") {
        const element = document.querySelector(selector);
        if (element && element instanceof HTMLElement) {
            return element;
        } 
    } else if (Array.isArray(selector)) {
        // If the selector is an array, return the first element that is a HTMLElement
        for (let i = 0; i < selector.length; i++) {
            if (selector[i] instanceof HTMLElement) {
                return selector[i];
            }
        }
    }
    // Return `null` if no elements match the selector or if the selector is invalid.
    return null;
}

/**
 * Executes a callback function on a resolved DOM element if it exists and is an instance of HTMLElement.
 *
 * @param {HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string or an HTMLElement to resolve the target element.
 * @param {(element: HTMLElement) => any} cb - A callback function to execute on the resolved element.
 * @returns {any|null} - The result of the callback function if the element is valid, otherwise null.
 * @throws {Error} - Throws an error if the resolved element is not an HTMLElement or null.
 */
function elementDo(selector, cb) {
    const element = resolveElement(selector);
    if (!(element instanceof HTMLElement || element === null)) {
        throw new Error(`Unexpected type returned by resolveElement: ${typeof element}`);
    }
    if (element) {
        return cb(element);
    }
    // No error, be quiet - we expect that it can be used with missed element or etc.
    return null;
}

/**
 * Resolves elements based on the provided selector.
 * If the selector is an HTMLElement, it wraps it in a DocumentFragment
 * and returns its child nodes. If the selector is a string, it queries
 * the DOM for matching elements and returns the NodeList.
 * 
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - The element or CSS selector to resolve.
 * @returns {Array<HTMLElement>|null} A NodeList of resolved elements, or null if no elements are found.
 */
function resolveElements(selector) {
    if (selector instanceof HTMLElement) {
        return [selector];
    } else if (selector instanceof NodeList) {
        if (selector.length > 0) {
            return Array.from(selector).filter(node => node instanceof HTMLElement);
        }
    } else if (selector instanceof DocumentFragment) {
        if (selector.childNodes && selector.childNodes.length > 0) {
            return resolveElements(selector.childNodes);
        }
    } else if (typeof selector === "string") {
        return resolveElements(document.querySelectorAll(selector));
    } else if (Array.isArray(selector)) {
        const result = selector.filter(node => node instanceof HTMLElement);
        if (result.length > 0) {
            return result;
        }
    }
    return null;
}

/**
 * Executes a callback function on each element resolved by the given selector.
 *
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string used to resolve elements.
 * @param {(element: HTMLElement) => any} cb - A callback function to execute on each resolved element.
 *                          The function receives an HTMLElement as its argument.
 * @returns {Array<any>|null} - An array of results from the callback function if elements are found,
 *                            `null` if no elements are resolved, or throws an error for unexpected types.
 * @throws {Error} - Throws an error if `resolveElements` returns an unexpected type.
 */
function elementsDo(selector, cb) {
    const elements = resolveElements(selector);
    if (!(elements instanceof Array || elements === null)) {
        throw new Error(`Unexpected type returned by resolveElements: ${typeof elements}`);
    }
    if (elements instanceof Array) {
        const results = [];
        elements.forEach((elem) => {
            results.push(cb(elem));
        });
        return results;
    }
    return null;
}

/**
 * Sets the visibility of elements matching the given selector.
 *
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string used to resolve elements.
 * @param {boolean} visible - A boolean indicating whether to show or hide the elements.
 * @throws {Error} - Throws an error if `resolveElements` returns an unexpected type.
 */
function setVisibility(selector, visible) {
    elementsDo(selector, (element) => {
        element.style.display = visible ? "block" : "none";
    });
}

/**
 * Determines whether the elements matching the given selector are visible.
 *
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string used to resolve elements.
 * @returns {boolean} Returns `true` if all resolved elements are visible; otherwise, `false`.
 *                    An element is considered not visible if its `display` style is "none"
 *                    or its `visibility` style is "hidden".
 * @throws {Error} - Throws an error if `resolveElements` returns an unexpected type.
 */
function isVisible(selector) {
    const elements = resolveElements(selector);
    if (!(elements instanceof Array)) return false;
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        // Walk up the tree to ensure no ancestor hides the element
        while (el && el instanceof HTMLElement) {
            const cs = window.getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity || "1") < 0.01) {
                return false; // Element is not visible
            }
            el = el.parentElement;
        }
    }
    return true;
}

/**
 * Removes all child nodes from the specified DOM element.
 *
 * @param {Node} element - The DOM element from which to remove all child nodes.
 * @returns {boolean} - Returns `true` if the operation was successful and the input was a valid Node, otherwise `false`.
 */
function removeAllChildren(element) {
    if (element instanceof Node) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        return true;
    }
    return false;
}

/**
 * Removes all child elements from the elements matched by the given selector.
 *
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string used to resolve elements.
 */
function removeAllChildrenFor(selector) {
    elementsDo(selector, removeAllChildren);
}

/**
 * Binds a click event listener to elements matching the given selector.
 * The provided callback is executed when the event is triggered.
 * If the callback returns `true`, the default action of the event is prevented.
 *
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string used to resolve elements.
 * @param {(this: HTMLElement, event: Event) => boolean|void} callback - A function to execute when the click event occurs.
 *        The function receives the event object as an argument and can optionally return `true` to prevent the default action.
 * @throws {Error} - Throws an error if `resolveElements` returns an unexpected type.
 */
function btnBind(selector, callback) {
    // Bake event handler
    const handleClickEvent = function(event) {
        const callbackResult = callback.call(this, event);
        if (typeof callbackResult === "boolean" && callbackResult) {
            event.preventDefault();
        }
    }

    elementsDo(selector, (element) => {
        element.addEventListener("click", handleClickEvent);
    });
}

/**
 * Binds a click event listener to visible elements matching the given selector.
 * The provided callback is executed when the event is triggered.
 * If the callback returns `true`, the default action of the event is prevented.
 *
 * @param {Array<HTMLElement>|HTMLElement|NodeList|DocumentFragment|string|any} selector - A CSS selector string used to resolve elements.
 * @param {(this: HTMLElement, event: Event) => boolean|void} callback - A function to execute when the click event occurs.
 *        The function receives the event object as an argument and can optionally return `true` to prevent the default action.
 * @returns {boolean[]} - An array of booleans indicating whether the event listener was successfully added to each visible element.
 * @throws {Error} - Throws an error if `resolveElements` returns an unexpected type.
 */
function btnBindVisible(selector, callback) {
    // Bake event handler
    const handleClickEvent = function(event) {
        const callbackResult = callback.call(this, event);
        if (typeof callbackResult === "boolean" && callbackResult) {
            event.preventDefault();
        }
    }

    return elementsDo(selector, (element) => {
        if (isVisible(element)) {
            element.addEventListener("click", handleClickEvent);
            return true;
        }
        return false;
    });
}

/**
 * Determines if the given result is considered "OK".
 * 
 * - If the input is an array, it recursively checks if all elements are "OK".
 * - If the input is a boolean, it returns true only if the value is `true`.
 * - If the input is `undefined` or `null`, it returns `false`.
 * - For all other values, it converts the value to a boolean.
 * 
 * @param {any} result - The value to evaluate.
 * @returns {boolean} `true` if the result is considered "OK", otherwise `false`.
 */
function isOK(result) {
    if (Array.isArray(result)) {
        return result.every(isOK);
    }
    if (typeof result === "boolean") {
        return result === true;
    }
    if (typeof result === "undefined" || result === null) {
        return false;
    }
    return !!result;
}

/**
 * Watches for changes in a value determined by a check function and triggers a callback when a change is detected.
 *
 * @param {string} key - A unique key to identify the watched value.
 * @param {() => any} checkFn - A function that returns the current value to be monitored.
 * @param {(curr: any, prev: any) => boolean} cb - A callback function invoked when the value changes. It receives the new value and the previous value as arguments.
 *                         If the callback returns `false`, the watcher will stop.
 * @param {boolean} [fireIfFirstOnChanged=true] - Whether to trigger the callback immediately if the initial value differs from the previous value.
 *                         If it called for the first time, it will be called with the current value and `undefined` as the previous value.
 * @param {number} [interval=100] - The interval (in milliseconds) at which the value is checked for changes.
 */
function watchChange(key, checkFn, cb, fireIfFirstOnChanged = true, interval = 100) {
    // Clear previous watcher for this key if any
    if (watchChange._handlers[key]) {
        clearInterval(watchChange._handlers[key]);
        delete watchChange._handlers[key];
    }
    let prev = watchChange._data[key];
    const curr = checkFn();
    watchChange._data[key] = curr;

    if (fireIfFirstOnChanged && prev !== curr) {
        try { cb(curr, prev); } catch (e) { /* swallow to keep watcher alive */ }
        prev = curr;
    }

    const handler = setInterval(() => {
        const next = checkFn();
        if (next !== prev) {
            watchChange._data[key] = next;
            let keep = true;
            try { keep = cb(next, prev) !== false; } catch (e) { /* ignore errors, keep watching */ }
            prev = next;
            if (!keep) {
                clearInterval(handler);
                delete watchChange._handlers[key];
            }
        }
    }, interval);
    watchChange._handlers[key] = handler;

    // Return an unsubscribe function
    return () => {
        if (watchChange._handlers[key]) {
            clearInterval(watchChange._handlers[key]);
            delete watchChange._handlers[key];
        }
    };
}
watchChange._data = {};
watchChange._handlers = {};
