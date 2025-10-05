import { h, text } from "./packages/hyperapp/index.js";
import {
  PASTE_OFFSET_X,
  PASTE_OFFSET_Y,
  OUTLINE_COLORS,
  OUTLINE_WIDTHS,
  BLOCK_CONTENTS_CLASS_NAME,
} from "./constants.js";
import { saveMementoAndReturn } from "./memento.js";
import { RESIZE_HANDLERS, ResizeHandle } from "./resize.js";
import { getViewportCenterCoordinates } from "./viewport.js";
import { clearUserClipboardEffect } from "./utils.js";
import {
  getCurrentBlocks,
  updateCurrentPage,
  getCurrentPage,
  getGlobalBlocks,
} from "./pages.js";
import {
  isBlockSelected,
  isBlockPreviewSelected,
  selectBlock,
  getFirstSelectedBlockId,
  getSelectedBlocks,
  toggleBlockSelection,
} from "./selection.js";

/**
 * Creates a block component renderer
 * @param {State} state - Current application state
 * @returns {(block: Block) => import("hyperapp").ElementVNode<State>} Block renderer function
 */
export function block(state) {
  return (block) => {
    const currentPage = getCurrentPage(state);
    if (!currentPage) return h("div", {});

    const isSelected = isBlockSelected(state, block.id);
    const isPreviewSelected = isBlockPreviewSelected(state, block.id);
    const selectedBlocks = getSelectedBlocks(state);
    const isMultiSelect = selectedBlocks.length > 1;
    const isEditing = currentPage.editingId === block.id;
    const isHovering = currentPage.hoveringId === block.id;
    const isOptionPressed = state.isOptionPressed;

    // Having small borders, i.e. 1px, can cause rendering glitches to occur when CSS transform translations are applied such as zooming out
    // Scale outline thickness inversely with zoom to maintain consistent visual appearance
    const outline = getBlockOutline(
      {
        isHovering,
        isEditing,
        isMultiSelect,
        isSelected,
        isPreviewSelected,
        isOptionPressed,
      },
      state,
    );

    /**
     * @param {State} state
     * @param {PointerEvent} event
     * @returns {import("./packages/hyperapp").Dispatchable<State>}
     */
    function onpointerover(state, event) {
      event.stopPropagation();
      const currentPage = getCurrentPage(state);
      if (!currentPage) return state;

      if (
        getFirstSelectedBlockId(state) !== null &&
        getFirstSelectedBlockId(state) !== block.id &&
        currentPage.dragStart !== null
      )
        return state;

      // Don't change cursor if we're over a resize handle
      const target = /** @type {HTMLElement} */ (event.target);
      if (target.classList.contains("resize-handle")) {
        return updateCurrentPage(state, {
          hoveringId: block.id,
        });
      }

      // Set cursor based on current mode (global option cursor will override)
      let cursorStyle;
      if (isMultiSelect) {
        cursorStyle = "default";
      } else if (
        currentPage.editingId === block.id ||
        currentPage.isInteractMode
      ) {
        // In edit mode, use default cursor
        cursorStyle = "default";
      } else {
        // Normal mode, use move cursor
        cursorStyle = "move";
      }
      console.log(block.pageSrc);

      // Only update wiki page when option key is held
      let updateData = {
        hoveringId: block.id,
        cursorStyle: cursorStyle,
      };

      if (state.isOptionPressed) {
        // Get current viewport position before changing to block's page
        const wikiViewer = document.querySelector("wiki-viewer");
        const currentViewportPosition = wikiViewer
          ? wikiViewer.saveViewportPosition()
          : null;

        updateData.wikiPage = block.pageSrc;
        updateData.wikiViewportPosition = currentViewportPosition;
      }

      return updateCurrentPage(state, updateData);
    }

    /**
     * @param {State} state
     * @param {PointerEvent} event
     * @returns {import("./packages/hyperapp").Dispatchable<State>}
     */
    function onpointerleave(state, event) {
      event.stopPropagation();

      // Get current viewport position from wiki viewer before clearing hover
      const wikiViewer = document.querySelector("wiki-viewer");
      const currentViewportPosition = wikiViewer
        ? wikiViewer.saveViewportPosition()
        : null;

      return updateCurrentPage(state, {
        hoveringId: null,
        cursorStyle: "default",
        wikiViewportPosition: currentViewportPosition,
      });
    }

    /**
     * @param {State} state
     * @param {PointerEvent} event
     * @returns {import("./packages/hyperapp").Dispatchable<State>}
     */
    function onpointerdown(state, event) {
      const currentPage = getCurrentPage(state);
      if (!currentPage) return state;
      if (isMultiSelect) return state;

      event.stopPropagation();

      // If block is in edit mode, don't start dragging
      if (currentPage.editingId === block.id || currentPage.isInteractMode) {
        return state;
      }

      // Handle shift-click for multi-select
      if (event.shiftKey) {
        return toggleBlockSelection(state, block.id);
      }

      // Normal selection and drag start
      const selectedState = selectBlock(state, block.id);
      return updateCurrentPage(selectedState, {
        dragStart: {
          id: block.id,
          startX: block.x,
          startY: block.y,
        },
      });
    }

    /**
     * @param {State} state
     * @param {MouseEvent} event
     * @returns {import("./packages/hyperapp").Dispatchable<State>}
     */
    function ondblclick(state, event) {
      event.stopPropagation();

      const currentPage = getCurrentPage(state);
      if (!currentPage) return state;
      if (currentPage.isInteractMode || currentPage.isTextEditorFocused) {
        return state;
      }

      // Double-click enters edit mode
      const selectedState = selectBlock(state, block.id);
      return updateCurrentPage(selectedState, {
        editingId: block.id,
        dragStart: null,
      });
    }

    return h(
      "div",
      {
        // Key ensures Hyperapp's virtual DOM can properly track each block element during list updates,
        // preventing DOM node reuse bugs when blocks are deleted (fixes positioning issues)
        key: `block-${block.id}`,
        "data-id": block.id,
        style: {
          outline: outline,
          transform: `translate(${block.x}px, ${block.y}px)`,
          width: `${block.width}px`,
          height: `${block.height}px`,
          zIndex: `${block.zIndex}`,
        },
        class: { block: true },
        onpointerover,
        onpointerleave,
        onpointerdown,
        ondblclick,
      },
      [
        h("img", {
          src: block.imageSrc.startsWith("file://")
            ? block.imageSrc
            : `file://${block.imageSrc}`,
          style: {
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          },
        }),
        ...(isSelected && !isEditing && !isMultiSelect
          ? Object.keys(RESIZE_HANDLERS).map((handle) =>
              ResizeHandle({
                handle: /** @type{ResizeString} */ (handle),
                zoom: currentPage.zoom,
                context: "block",
              }),
            )
          : []),
      ],
    );
  };
}

/**
 * Creates a CSS outline string with zoom-adjusted width
 * @param {number} width - Base width in pixels
 * @param {string} color - CSS color value
 * @param {number} zoom - Current zoom level
 * @returns {string} CSS outline property value
 */
function createOutline(width, color, zoom) {
  return `${width / zoom}px solid ${color}`;
}

/**
 * Determines the outline style for a block based on its current state
 * @param {{isHovering: boolean, isEditing: boolean, isMultiSelect: boolean, isSelected: boolean, isPreviewSelected: boolean, isOptionPressed: boolean}} blockState - Block state flags
 * @param {State} state - Application state
 * @returns {string|null} CSS outline property value
 */
function getBlockOutline(blockState, state) {
  const {
    isHovering,
    isEditing,
    isMultiSelect,
    isSelected,
    isPreviewSelected,
    isOptionPressed,
  } = blockState;

  const currentPage = getCurrentPage(state);
  if (!currentPage) return null;

  if (isEditing) {
    return createOutline(
      OUTLINE_WIDTHS.THICK,
      OUTLINE_COLORS.EDITING,
      currentPage.zoom,
    );
  }

  if (isMultiSelect) {
    return ""; // No outline for multi-select
  }

  if (isSelected) {
    return createOutline(
      OUTLINE_WIDTHS.THICK,
      OUTLINE_COLORS.SELECTED,
      currentPage.zoom,
    );
  }

  if (isPreviewSelected) {
    return createOutline(
      OUTLINE_WIDTHS.MEDIUM,
      OUTLINE_COLORS.PREVIEW_SELECTED,
      currentPage.zoom,
    );
  }

  if (isHovering) {
    return createOutline(
      OUTLINE_WIDTHS.THIN,
      OUTLINE_COLORS.HOVERING,
      currentPage.zoom,
    );
  }

  if (isOptionPressed) {
    return createOutline(
      OUTLINE_WIDTHS.THIN,
      OUTLINE_COLORS.INTERACT_MODE,
      currentPage.zoom,
    );
  }

  return null; // Default: no outline
}

// -----------------------------
// ## Components
// -----------------------------

/**
 * Sends a block to the front (highest z-index)
 * @param {State} currentState - Current application state
 * @param {number} blockId - ID of block to bring to front
 * @returns {import("hyperapp").Dispatchable<State>} Updated state
 */
export function sendToFront(currentState, blockId) {
  const blocks = getCurrentBlocks(currentState);
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return currentState;

  // Find the highest z-index among all blocks
  const maxZIndex = Math.max(...blocks.map((b) => b.zIndex));

  const newState = {
    ...updateCurrentPage(currentState, {
      blocks: blocks.map((b) =>
        b.id === blockId ? { ...b, zIndex: maxZIndex + 1 } : b,
      ),
    }),
  };

  return saveMementoAndReturn(currentState, newState);
}

/**
 * Sends a block to the back (lowest z-index)
 * @param {State} currentState - Current application state
 * @param {number} blockId - ID of block to send to back
 * @returns {import("hyperapp").Dispatchable<State>} Updated state
 */
export function sendToBack(currentState, blockId) {
  const blocks = getCurrentBlocks(currentState);
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return currentState;

  // Find the lowest z-index among all blocks
  const minZIndex = Math.min(...blocks.map((b) => b.zIndex));

  const newState = {
    ...updateCurrentPage(currentState, {
      blocks: blocks.map((b) =>
        b.id === blockId ? { ...b, zIndex: minZIndex - 1 } : b,
      ),
    }),
  };

  return saveMementoAndReturn(currentState, newState);
}

/**
 * Deletes a block from the state
 * @param {State} state - Current application state
 * @returns {import("hyperapp").Dispatchable<State>} Updated state without the block
 */
export function deleteSelectedBlocks(state) {
  const currentPage = getCurrentPage(state);
  if (!currentPage) return state;

  const newState = updateCurrentPage(state, {
    blocks: currentPage.blocks.filter(
      (block) => !currentPage.selectedIds.includes(block.id),
    ),
    selectedIds: [],
  });

  return saveMementoAndReturn(state, newState);
}

/**
 * Adds a new block to the state and renders its program
 * @param {State} state - Current application state
 * @param {string} imageSrc
 * @param {string} pageSrc
 * @param {number | null} x - X position on canvas. If null, uses viewport's center X coordinate
 * @param {number | null} y - Y position on canvas. If null, uses viewport's center X coordinate
 * @param {number} width - Block width in pixels
 * @param {number} height - Block height in pixels
 * @param {Object|null} viewportPosition - Viewport position when block was captured
 * @returns {State} Updated state with new block */
export function addBlock(
  state,
  imageSrc,
  pageSrc,
  x = null,
  y = null,
  width = 200,
  height = 200,
  viewportPosition = null,
) {
  // If no coordinates provided, use viewport center
  if (x === null || y === null) {
    const viewportCenter = getViewportCenterCoordinates(state);
    x = x ?? viewportCenter.x - width / 2; // Center the block
    y = y ?? viewportCenter.y - height / 2; // Center the block
  }
  const currentPage = getCurrentPage(state);
  if (!currentPage) return state;
  const globalBlocks = getGlobalBlocks(state);

  /** @type {Block} */
  const newBlock = {
    id: Math.max(...globalBlocks.map((block) => block.id), 0) + 1,
    width: width,
    height: height,
    x: x,
    y: y,
    zIndex: Math.max(...globalBlocks.map((block) => block.zIndex), 0) + 1,
    imageSrc,
    pageSrc,
    viewportPosition,
  };

  const currentBlocks = getCurrentBlocks(state);
  const newState = updateCurrentPage(state, {
    blocks: [...currentBlocks, newBlock],
  });

  const selectedState = selectBlock(newState, newBlock.id);

  return saveMementoAndReturn(state, selectedState);
}

/**
 * Adds multiple blocks to the state
 * @param {State} state - Current application state
 * @param {Array<{imageSrc: string, pageSrc: string, programState?: Object|null, x?: number|null, y?: number|null, width?: number, height?: number, viewportPosition?: Object|null}>} blockConfigs - Array of block configurations
 * @returns {{state: State, blockIds: number[]}} Updated state with new blocks and array of new block IDs
 */
function addBlocks(state, blockConfigs) {
  if (!Array.isArray(blockConfigs) || blockConfigs.length === 0) {
    return { state, blockIds: [] };
  }

  let currentState = state;
  const newBlockIds = [];

  // Add each block sequentially
  for (const config of blockConfigs) {
    const {
      imageSrc,
      pageSrc,
      x = null,
      y = null,
      width = 200,
      height = 200,
      viewportPosition = null,
    } = config;

    //BUG: fix
    currentState = addBlock(
      currentState,
      imageSrc,
      pageSrc,
      x,
      y,
      width,
      height,
      viewportPosition,
    );

    // Get the ID of the newly added block
    const currentBlocks = getCurrentBlocks(currentState);
    const lastBlock = currentBlocks[currentBlocks.length - 1];
    if (lastBlock) {
      newBlockIds.push(lastBlock.id);
    }
  }

  return { state: currentState, blockIds: newBlockIds };
}

/**
 * Pastes blocks from clipboard into the state
 * @param {State} state - Current application state
 * @returns {import("hyperapp").Dispatchable<State>} Updated state with pasted blocks
 */
export function pasteClipboardBlocks(state) {
  const clipboardData = state.clipboard;
  if (clipboardData === null) {
    return state;
  }

  // Transform clipboard data into block configurations for addBlocks
  const blockConfigs = clipboardData.map((blockData) => ({
    x: blockData.x + PASTE_OFFSET_X,
    y: blockData.y + PASTE_OFFSET_Y,
    width: blockData.width,
    height: blockData.height,
    imageSrc: blockData.imageSrc,
    pageSrc: blockData.pageSrc,
    viewportPosition: blockData.viewportPosition,
  }));

  const { state: newState, blockIds } = addBlocks(state, blockConfigs);

  // Select all pasted blocks
  if (blockIds.length > 0) {
    return updateCurrentPage(newState, {
      selectedIds: blockIds,
    });
  }

  return newState;
}

/**
 * Copies the selected blocks to application clipboard
 * @param {State} state - Current application state
 * @returns {import("hyperapp").Dispatchable<State>} Updated state with clipboard data
 */
export function copySelectedBlocks(state) {
  const selectedBlocks = getSelectedBlocks(state);
  if (selectedBlocks.length === 0) return state;

  // Create copies of the block data for clipboard, capturing current state
  /** @type {Block[]} */
  const blocksData = selectedBlocks
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((block) => ({
      ...block,
      id: -1, // not a "real" block
    }));

  return [
    {
      ...state,
      clipboard: blocksData,
    },
    clearUserClipboardEffect,
  ];
}
