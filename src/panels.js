import { h, text } from "./packages/hyperapp/index.js";
import { sendToBack, sendToFront } from "./block.js";
import {
  createPage,
  switchPage,
  deletePage,
  renamePage,
  updateCurrentPage,
  getCurrentPage,
} from "./pages.js";
import { getSelectedBlocks } from "./selection.js";
import "./ace-editor.js";

/**
 * Creates the panels container with both layers panel, programs panel and floating toggle button
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>[]} Array of panel elements
 */
export function panelsContainer(state) {
  return [
    rightPanel(state),
    // Only show floating toggle button when panels are hidden
    ...(state.panelsVisible ? [] : [panelsToggle(state)]),
  ];
}

/**
 * Creates the layers panel on the left side
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>} Layers panel element
 */
function pages(state) {
  return h(
    "div",
    {
      id: "layers-panel",
      onpointerdown: (state, event) => {
        event.stopPropagation();
        return state;
      },
    },
    [
      h("h2", {}, text("Pages")),
      h(
        "button",
        {
          class: "layers-panel-button",
          onclick: (state) => createPage(state),
        },
        text("+ New Page"),
      ),

      ...pageLabels(state),
    ],
  );
}

/**
 * Creates the layers panel on the left side
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>[]} Layers panel element
 */
function pageLabels(state) {
  return state.pages.map((page) =>
    h(
      "div",
      {
        key: page.id,
        class: {
          "page-item": true,
          active: page.id === state.currentPageId,
        },
        onclick: (state) => {
          const newState = switchPage(state, page.id);
          // Only clear editing state if we're not clicking on the currently editing page
          return state.editingPageId !== null && state.editingPageId !== page.id
            ? { ...newState, editingPageId: null }
            : newState;
        },
      },
      [
        state.editingPageId === page.id
          ? h("input", {
              type: "text",
              value: page.name,
              class: "page-name-base page-name-input",
              oninput: (state, event) => {
                const newName = /** @type {HTMLInputElement} */ (event.target)
                  .value;
                return renamePage(state, page.id, newName);
              },
              onkeydown: (state, event) => {
                const keyEvent = /** @type {KeyboardEvent} */ (event);
                if (keyEvent.key === "Enter" || keyEvent.key === "Escape") {
                  keyEvent.preventDefault();
                  return { ...state, editingPageId: null };
                }
                return state;
              },
              onblur: (state) => ({ ...state, editingPageId: null }),
              onpointerdown: (state, event) => {
                event.stopPropagation();
                return state;
              },
            })
          : h(
              "span",
              {
                class: "page-name-base page-name",
                ondblclick: (state) => ({
                  ...state,
                  editingPageId: page.id,
                }),
              },
              text(page.name),
            ),
        state.pages.length > 1
          ? h(
              "button",
              {
                class: "page-delete-button",
                onclick: (state, event) => {
                  event.stopPropagation();
                  return deletePage(state, page.id);
                },
              },
              text("×"),
            )
          : null,
      ],
    ),
  );
}

/**
 * Creates the Wikipedia viewer component
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>} Wikipedia viewer element
 */
function wikipediaViewer(state) {
  return h(
    "div",
    {
      style: {
        maxWidth: "700px",
        margin: "0 auto",
        fontFamily: "sans-serif",
        height: "100%",
        overflowY: "auto",
        padding: "20px",
      },
    },
    [
      h("h1", {}, text("Wikipedia Viewer")),
      h("p", {}, [
        text("Currently viewing: "),
        h("b", {}, text(state.wikiPage)),
      ]),
      state.wikiLoading && h("p", {}, text("Loading...")),
      h("div", {
        id: "wiki-content",
        innerHTML: state.wikiContent,
        style: { lineHeight: "1.6" },
      }),
    ],
  );
}

/**
 * Creates the programs panel on the right side
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>} Programs panel element
 */
function rightPanel(state) {
  return h(
    "div",
    {
      id: "right-panel",
      class: {
        hidden: !state.panelsVisible,
      },
      style: {
        width: `40%`,
        overflowY: "auto",
      },
      onpointerdown: (state, event) => {
        event.stopPropagation();
        return state;
      },
    },
    [wikipediaViewer(state), orderButtons(state)],
  );
}

/**
 * Creates a program buttons component with filter functionality
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>} Program buttons element
 */
function orderButtons(state) {
  const selectedBlock = getSelectedBlocks(state)[0];
  if (!selectedBlock) return h("div", {});

  return h("div", {}, [
    h("div", {}, [
      h(
        "button",
        {
          onclick: (state, event) => {
            event.stopPropagation();
            return sendToBack(state, selectedBlock.id);
          },
        },
        text("send to back"),
      ),
      h(
        "button",
        {
          onclick: (state, event) => {
            event.stopPropagation();
            return sendToFront(state, selectedBlock.id);
          },
        },
        text("send to front"),
      ),
    ]),
  ]);
}

/**
 * Toggles visibility of panels
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>}
 */
function panelsToggle(state) {
  return h(
    "button",
    {
      id: "panels-toggle",
      onclick: (state) => ({
        ...state,
        panelsVisible: !state.panelsVisible,
      }),
      title: "Show panels",
    },
    text("▶"),
  );
}
