"use client";

import { createContext, useContext } from "react";

/**
 * DOM node where nested editor sheets should mount as an in-panel sub-view
 * instead of a full-screen modal. Provided by the desktop builder (the left
 * sidebar). Null on mobile / outside the desktop panel, where sheets fall back
 * to the bottom-sheet modal.
 */
export const PanelHostContext = createContext<HTMLElement | null>(null);

export const usePanelHost = () => useContext(PanelHostContext);
