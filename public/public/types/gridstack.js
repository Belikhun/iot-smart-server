
/**
 * @typedef {HTMLElement} GridHTMLElement
 * @property {GridStack} [gridstack] Optional GridStack instance
 */

/**
 * @typedef {'added' | 'change' | 'disable' | 'drag' | 'dragstart' | 'dragstop' | 'dropped' | 'enable' | 'removed' | 'resize' | 'resizestart' | 'resizestop' | 'resizecontent'} GridStackEvent
 */

/**
 * @typedef {Object} MousePosition
 * @property {number} top
 * @property {number} left
 */

/**
 * @typedef {Object} CellPosition
 * @property {number} x
 * @property {number} y
 */

const gridDefaults = {
    alwaysShowResizeHandle: 'mobile',
    animate: true,
    auto: true,
    cellHeight: 'auto',
    cellHeightThrottle: 100,
    cellHeightUnit: 'px',
    column: 12,
    draggable: { handle: '.grid-stack-item-content', appendTo: 'body', scroll: true },
    handle: '.grid-stack-item-content',
    itemClass: 'grid-stack-item',
    margin: 10,
    marginUnit: 'px',
    maxRow: 0,
    minRow: 0,
    placeholderClass: 'grid-stack-placeholder',
    placeholderText: '',
    removableOptions: { accept: 'grid-stack-item', decline: 'grid-stack-non-removable' },
    resizable: { handles: 'se' },
    rtl: 'auto',
    // **** same as not being set ****
    // disableDrag: false,
    // disableResize: false,
    // float: false,
    // handleClass: null,
    // removable: false,
    // staticGrid: false,
    // styleInHead: false,
    //removable
};

/**
 * @class
 * @param {GridHTMLElement} el
 * @param {GridStackOptions} [opts]
 */
class GridStack {
    constructor(el, opts) {
        /**
         * @type {GridHTMLElement}
         */
        this.el = el;

        /**
         * @type {GridStackOptions}
         */
        this.opts = opts;

        this.animationDelay = 0;
        this.resizeObserver = new ResizeObserver(() => {});
        this._skipInitialResize = false;

        /**
         * @type {GridStackEngine}
         */
        this.engine = new GridStackEngine();

        /** @type {GridStackNode | undefined} */
        this.parentGridNode = undefined;
    }

    /**
     * @param {GridStackWidget} w
     * @returns {GridItemHTMLElement}
     */
    addWidget(w) {
        // Implement widget addition logic
    }

    /**
     * @param {GridItemHTMLElement} el
     * @param {GridStackOptions} [ops]
     * @param {GridStackNode} [nodeToAdd]
     * @param {boolean} [saveContent]
     * @returns {GridStack}
     */
    makeSubGrid(el, ops, nodeToAdd, saveContent) {
        // Implement sub-grid creation logic
    }

    /**
     * @param {GridStackNode} [nodeThatRemoved]
     */
    removeAsSubGrid(nodeThatRemoved) {
        // Implement sub-grid removal logic
    }

    /**
     * @param {boolean} [saveContent]
     * @param {boolean} [saveGridOpt]
     * @param {SaveFcn} [saveCB]
     * @returns {GridStackWidget[] | GridStackOptions}
     */
    save(saveContent, saveGridOpt, saveCB) {
        // Implement save logic
    }

    /**
     * @param {GridStackWidget[]} items
     * @param {boolean | AddRemoveFcn} [addRemove]
     * @returns {GridStack}
     */
    load(items, addRemove) {
        // Implement loading logic
    }

    /**
     * @param {boolean} [flag]
     * @returns {GridStack}
     */
    batchUpdate(flag) {
        // Implement batch update logic
    }

    /**
     * @param {boolean} [forcePixel]
     * @returns {number}
     */
    getCellHeight(forcePixel) {
        // Implement cell height logic
    }

    /**
     * @param {numberOrString} val
     * @param {boolean} [update]
     * @returns {GridStack}
     */
    cellHeight(val, update) {
        // Implement cell height setter logic
    }

    /**
     * @returns {number}
     */
    cellWidth() {
        // Implement cell width logic
    }

    /**
     * @param {boolean} [doEnable]
     * @param {boolean} [recurse]
     * @returns {GridStack}
     */
    enableMove(doEnable, recurse) {
        // Implement move enabling logic
    }

    /**
     * @param {boolean} [doEnable]
     * @param {boolean} [recurse]
     * @returns {GridStack}
     */
    enableResize(doEnable, recurse) {
        // Implement resize enabling logic
    }

    /**
     * @returns {GridStack}
     */
    commit() {
        // Implement commit logic
    }
}

/**
 * @typedef {Object} GridStackOptions
 * @property {number} column
 * @property {number} row
 * @property {number} width
 * @property {number} height
 */
