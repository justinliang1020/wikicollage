import { app, h } from "./packages/hyperapp/index.js";
import { STATE_SAVE_PATH, MEDIA_SAVE_PATH } from "./constants.js";
import { createMementoManager } from "./memento.js";
import { viewport, onkeydown } from "./viewport.js";
import { panelsContainer } from "./panels.js";
import {
  notification,
  saveApplication,
  saveApplicationAndNotify,
} from "./utils.js";
import { defaultPage, getCurrentPage, updateCurrentPage } from "./pages.js";
import { addBlock } from "./block.js";

initialize();

/**
 * @param {import("hyperapp").Action<State>} action
 * @returns {import("hyperapp").Subscription<State>}
 */
const onKeyDown = (action) => {
  /**
   * @param {import("hyperapp").Dispatch<State>} dispatch
   * @param {any} options
   */
  function keydownSubscriber(dispatch, options) {
    /**
     * @param {KeyboardEvent} event
     */
    function handler(event) {
      dispatch(options.action, event);
    }
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }
  return [keydownSubscriber, { action }];
};

/**
 * @param {import("hyperapp").Action<State>} action
 * @returns {import("hyperapp").Subscription<State>}
 */
const onKeyUp = (action) => {
  /**
   * @param {import("hyperapp").Dispatch<State>} dispatch
   * @param {any} options
   */
  function keyupSubscriber(dispatch, options) {
    /**
     * @param {KeyboardEvent} event
     */
    function handler(event) {
      dispatch(options.action, event);
    }
    addEventListener("keyup", handler);
    return () => removeEventListener("keyup", handler);
  }
  return [keyupSubscriber, { action }];
};

/**
 * @param {State} state
 * @param {KeyboardEvent} event
 * @returns {import("hyperapp").Dispatchable<State>}
 */
const KeyDown = (state, event) => {
  // First try viewport keyboard handling
  const viewportResult = onkeydown(state, event);
  if (viewportResult !== state) {
    return viewportResult;
  }

  switch (event.key) {
    case "Shift":
      return {
        ...state,
        isShiftPressed: true,
      };
    case "Alt":
      return {
        ...state,
        isOptionPressed: true,
      };
    case "s":
      // Handle save shortcut (Ctrl+S or Cmd+S)
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        return [state, (dispatch) => saveApplicationAndNotify(dispatch, state)];
      }
      return state;
    default:
      return state;
  }
};

/**
 * @param {State} state
 * @param {KeyboardEvent} event
 * @returns {import("hyperapp").Dispatchable<State>}
 */
const KeyUp = (state, event) => {
  switch (event.key) {
    case "Shift":
      return {
        ...state,
        isShiftPressed: false,
      };
    case "Alt":
      return {
        ...state,
        isOptionPressed: false,
      };
    default:
      return state;
  }
};

/**
 * Creates the main application component
 * @param {State} state - Current application state
 * @returns {import("hyperapp").ElementVNode<State>} Main application element
 */
function main(state) {
  const currentPage = state.pages.find((p) => p.id === state.currentPageId);

  // Override cursor style when option key is pressed
  const cursorStyle = state.isOptionPressed
    ? "zoom-in"
    : currentPage?.cursorStyle || "default";

  return h(
    "main",
    {
      style: {
        cursor: cursorStyle,
      },
      class: {
        "dark-mode": state.isDarkMode,
      },
    },
    [viewport(state), ...panelsContainer(state), notification(state)],
  );
}

function initialState() {
  /** @type {State} */
  const state = {
    pages: [defaultPage],
    currentPageId: "",
    mementoManager: createMementoManager(),
    isDarkMode: false,
    panelsVisible: true,
    programsPanelWidth: 300,
    clipboard: null,
    programFilter: "",
    notification: null,
    notificationVisible: false,
    editingPageId: null,
    isShiftPressed: false,
    isOptionPressed: false,
  };

  // Set currentPageId to the first page
  state.currentPageId = state.pages[0].id;
  return state;
}

/**
 * Subscription that handles hyperapp
 * @param {import("hyperapp").Dispatch<State>} dispatch - Function to dispatch actions
 * @returns {() => void} Cleanup function
 */
function themeChangeSubscription(dispatch) {
  /**
   * @param {boolean} isDark - Whether the system theme is dark
   */
  const handleThemeChange = (isDark) => {
    dispatch((state) => ({
      ...state,
      isDarkMode: isDark,
    }));
  };
  // @ts-ignore
  const listener = window.electronAPI.onThemeChanged(handleThemeChange);

  // Return cleanup function (required for subscriptions)
  return () => {
    // @ts-ignore
    window.electronAPI.removeThemeListener(listener);
  };
}

/**
 * @param {any} state
 */
function safeToEmitState(state) {
  return JSON.parse(
    JSON.stringify(state, (key, value) => {
      // Skip the problematic properties
      if (key === "state") return "<redacted>";
      return value;
    }),
  );
}

/**
 * Clipboard monitoring subscription that checks for image changes
 * @param {import("hyperapp").Dispatch<State>} dispatch Hyperapp dispatch function
 * @returns {() => void} Cleanup function
 */
const ClipboardMonitor = (dispatch) => {
  /** @type {string | null} */
  let lastImage = null;

  const checkClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const item = clipboardItems[0];
      if (!item) return;
      if (
        item.types.includes("image/png") ||
        item.types.includes("image/jpeg")
      ) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) return;

        const blob = await item.getType(imageType);
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target) {
              resolve(/** @type {string} */ (e.target.result));
            }
          };
          reader.readAsDataURL(blob);
        });

        if (dataUrl !== lastImage) {
          lastImage = /** @type {string} */ (dataUrl);

          // Save the image to user data file
          const arrayBuffer = await blob.arrayBuffer();
          try {
            // @ts-ignore
            const result = await window.fileAPI.saveImageFromBuffer(
              arrayBuffer,
              imageType,
              MEDIA_SAVE_PATH,
            );
            if (result.success) {
              dispatch((state) => {
                const currentPage = getCurrentPage(state);
                if (!currentPage) return state;
                console.log(currentPage.wikiPage);

                // Get the current scroll position from the wiki viewer
                const wikiViewer = document.querySelector("wiki-viewer");
                const viewportPosition = wikiViewer
                  ? wikiViewer.saveViewportPosition()
                  : null;

                const newState = addBlock(
                  state,
                  result.path,
                  currentPage.wikiPage,
                  null,
                  null,
                  200,
                  200,
                  viewportPosition,
                );
                return newState;
              });
            }
          } catch (error) {
            console.error("Failed to save clipboard image:", error);
          }
        }
      } else {
      }
    } catch (err) {
      // error happens if user loses focus on document
      console.log("No clipboard access or no image in clipboard", err);
    }
  };

  const interval = setInterval(checkClipboard, 200);
  return () => clearInterval(interval);
};

/** @type{import("hyperapp").Action<State> | null} */
let prevDispatchAction = null;
/** @type{any} */
let prevDispatchPayload = null;
/** @type{State | null} */
let prevState = null;

/**
 * For now, i won't think about effects or manual dispatch. Only actions and state
 * @type {(dispatch: import("hyperapp").Dispatch<State>) => import("hyperapp").Dispatch<State>}
 */
const dispatchMiddleware = (dispatch) => (action, payload) => {
  // Action<S, P>
  if (typeof action === "function") {
    prevDispatchAction = action;
    prevDispatchPayload = payload;
  }
  if (Array.isArray(action) && typeof action[0] !== "function") {
    // [state: S, ...effects: MaybeEffect<S, P>[]]
  } else if (!Array.isArray(action) && typeof action !== "function") {
    // state
    const state = action;
    if (prevDispatchAction !== null && prevDispatchAction.name) {
      /** @type {AppDispatchEventDetail} */
      const detail = {
        state: safeToEmitState(state),
        action: prevDispatchAction,
        payload: prevDispatchPayload,
        prevState: safeToEmitState(prevState),
      };
      const event = new CustomEvent("appDispatch", {
        detail,
      });
      dispatchEvent(event);
    }
    prevDispatchAction = null;
    prevDispatchPayload = null;
    // @ts-ignore
    prevState = state;
  }
  dispatch(action, payload);
};

/**
 * Initializes the application with saved state and starts the Hyperapp
 * @returns {Promise<void>}
 */
async function initialize() {
  /** @type {State} */
  let state;
  try {
    // @ts-ignore
    state = await window.fileAPI.readFile(STATE_SAVE_PATH); // uncomment to have retained state
    if (!state) {
      state = initialState();
    }
    state.mementoManager = createMementoManager();
  } catch {
    state = initialState();
  }

  // Initialize dark mode based on system theme
  try {
    // @ts-ignore
    const systemIsDark = await window.fileAPI.getSystemTheme();
    state.isDarkMode = systemIsDark;
  } catch (error) {
    console.warn("Failed to get system theme, using default:", error);
  }

  // Listen for quit signal from main process
  //@ts-ignore
  window.electronAPI.onAppWillQuit(() => {
    saveApplication(state);

    // Tell main process we're done
    //@ts-ignore
    window.electronAPI.stateSaved();
  });

  app({
    init: state,
    view: (state) => main(state),
    node: /** @type {Node} */ (document.getElementById("app")),
    subscriptions: (state) => [
      [themeChangeSubscription, {}],
      onKeyDown(KeyDown),
      onKeyUp(KeyUp),
      [ClipboardMonitor, {}],
    ],
    dispatch: dispatchMiddleware,
  });
}
