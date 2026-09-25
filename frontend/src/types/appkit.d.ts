import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "appkit-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        size?: "sm" | "md" | "lg";
        balance?: "show" | "hide";
      };
    }
  }
}

export {};
