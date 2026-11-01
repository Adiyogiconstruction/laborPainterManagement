import { useEffect, useRef, useState } from "react";
import styles from "../../styles/design.module.css";

export function StickyHorizontalScrollbar({ targetRef }) {
  const scrollbarRef = useRef(null);
  const [dimensions, setDimensions] = useState(null);

  useEffect(() => {
    const scrollbar = scrollbarRef.current;
    if (!scrollbar) return undefined;

    let frame = 0;
    let target = null;
    let targetResizeObserver = null;
    let targetMutationObserver = null;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!target) return;
        const hasHorizontalOverflow =
          target.scrollWidth > target.clientWidth + 1;
        const nextDimensions = {
          contentWidth:
            target.scrollWidth + scrollbar.clientWidth - target.clientWidth,
          visible: hasHorizontalOverflow,
        };
        setDimensions((current) =>
          current?.contentWidth === nextDimensions.contentWidth &&
          current.visible === nextDimensions.visible
            ? current
            : nextDimensions,
        );
        if (hasHorizontalOverflow) {
          scrollbar.scrollLeft = target.scrollLeft;
        }
      });
    };

    const syncTarget = () => {
      if (target && target.scrollLeft !== scrollbar.scrollLeft) {
        target.scrollLeft = scrollbar.scrollLeft;
      }
    };
    const syncScrollbar = () => {
      if (target && scrollbar.scrollLeft !== target.scrollLeft) {
        scrollbar.scrollLeft = target.scrollLeft;
      }
    };

    const updateTarget = () => {
      const nextTarget = targetRef.current;
      if (nextTarget === target) return;

      if (target) {
        target.removeEventListener("scroll", syncScrollbar);
      }
      targetResizeObserver?.disconnect();
      targetMutationObserver?.disconnect();
      target = nextTarget;

      if (!target) {
        setDimensions(null);
        return;
      }

      target.addEventListener("scroll", syncScrollbar, { passive: true });
      targetResizeObserver = new ResizeObserver(measure);
      targetResizeObserver.observe(target);
      if (target.firstElementChild) {
        targetResizeObserver.observe(target.firstElementChild);
      }
      targetMutationObserver = new MutationObserver(measure);
      targetMutationObserver.observe(target, { childList: true, subtree: true });
      measure();
    };

    scrollbar.addEventListener("scroll", syncTarget, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const targetObserver = new MutationObserver(updateTarget);
    targetObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    updateTarget();

    return () => {
      cancelAnimationFrame(frame);
      target?.removeEventListener("scroll", syncScrollbar);
      scrollbar.removeEventListener("scroll", syncTarget);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      targetObserver.disconnect();
      targetResizeObserver?.disconnect();
      targetMutationObserver?.disconnect();
    };
  }, [targetRef]);

  return (
    <div
      className={`${styles["sticky-horizontal-scroll"]} ${
        dimensions?.visible ? "" : styles["sticky-horizontal-scroll-hidden"]
      }`}
      aria-hidden={!dimensions?.visible}
    >
      <div
        ref={scrollbarRef}
        className={styles["sticky-horizontal-scroll-track"]}
        role="region"
        aria-label="Scroll table horizontally"
        tabIndex={0}
      >
        <div style={{ width: `${dimensions?.contentWidth || 0}px`, height: 1 }} />
      </div>
    </div>
  );
}
