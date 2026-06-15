import { useEffect, useRef, useState } from "react";

import {
  ScrollArea,
  ScrollAreaViewport,
  ScrollBar,
} from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type RailSelectorItem = {
  value: number;
  label: string;
  displayLabel?: string;
};

type RailSelectorProps = {
  label: string;
  orientation: "horizontal" | "vertical";
  items: RailSelectorItem[];
  selectedValue: number;
  onSelect: (value: number) => void;
  className?: string;
};

type RailItemProps = {
  item: RailSelectorItem;
  label: string;
  isSelected: boolean;
  onSelect: (value: number) => void;
  registerItem: (value: number, node: HTMLButtonElement | null) => void;
};

function VerticalRailItem({
  item,
  label,
  isSelected,
  onSelect,
  registerItem,
}: RailItemProps) {
  return (
    <button
      ref={(node) => {
        registerItem(item.value, node);
      }}
      type="button"
      onClick={() => {
        onSelect(item.value);
      }}
      aria-label={`${label} ${item.displayLabel ?? item.label}`}
      aria-pressed={isSelected}
      className={cn(
        "group flex h-7 shrink-0 items-center gap-2 rounded-md pl-3 pr-1 text-left text-muted-foreground transition-[color,transform] duration-150 hover:z-10 hover:scale-110 hover:text-foreground focus-visible:z-10 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-8 sm:gap-2 sm:pl-4 sm:pr-1.5",
        isSelected ? "text-foreground" : "text-muted-foreground/80",
      )}
    >
      <span
        className={cn(
          "whitespace-nowrap text-[0.62rem] tracking-[0.03em] transition-transform duration-150 sm:text-[0.66rem] sm:tracking-[0.03em]",
          isSelected && "-translate-x-1 sm:-translate-x-2",
        )}
      >
        {item.displayLabel ?? item.label}
      </span>

      <span aria-hidden="true" className="flex w-6 shrink-0 justify-end sm:w-7">
        <span
          className={cn(
            "block h-px w-4.5 origin-right bg-current transition-[opacity,transform] duration-200 sm:w-5",
            isSelected ? "scale-x-140 opacity-100" : "scale-x-100 opacity-45",
          )}
        />
      </span>
    </button>
  );
}

function HorizontalRailItem({
  item,
  label,
  isSelected,
  onSelect,
  registerItem,
}: RailItemProps) {
  return (
    <button
      ref={(node) => {
        registerItem(item.value, node);
      }}
      type="button"
      onClick={() => {
        onSelect(item.value);
      }}
      aria-label={`${label} ${item.displayLabel ?? item.label}`}
      aria-pressed={isSelected}
      className={cn(
        "group flex shrink-0 flex-col items-center gap-1.25 px-1.25 pb-0.75 pt-2.5 text-left text-muted-foreground transition-[color,transform] duration-150 hover:z-10 hover:scale-110 hover:text-foreground focus-visible:z-10 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:gap-1.5 sm:px-1.5 sm:pb-1 sm:pt-3",
        isSelected ? "text-foreground" : "text-muted-foreground/80",
      )}
    >
      <span
        className={cn(
          "whitespace-nowrap text-[0.58rem] uppercase tracking-[0.1em] transition-transform duration-150 sm:text-[0.62rem] sm:tracking-[0.12em]",
          isSelected && "-translate-y-1 sm:-translate-y-2",
        )}
      >
        {item.displayLabel ?? item.label}
      </span>

      <span aria-hidden="true" className="flex h-6 shrink-0 items-end sm:h-7">
        <span
          className={cn(
            "block h-4.5 w-px origin-bottom bg-current transition-[opacity,transform] duration-200 sm:h-5",
            isSelected ? "scale-y-140 opacity-100" : "scale-y-100 opacity-45",
          )}
        />
      </span>
    </button>
  );
}

export function RailSelector({
  label,
  orientation,
  items,
  selectedValue,
  onSelect,
  className,
}: RailSelectorProps) {
  const isVertical = orientation === "vertical";
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const [edgeSpacer, setEdgeSpacer] = useState(0);
  const ItemComponent = isVertical ? VerticalRailItem : HorizontalRailItem;

  const animateViewportScroll = (
    viewport: HTMLDivElement,
    axis: "x" | "y",
    nextOffset: number,
  ) => {
    const startOffset = axis === "y" ? viewport.scrollTop : viewport.scrollLeft;
    const clampedOffset = Math.max(0, nextOffset);

    if (Math.abs(clampedOffset - startOffset) < 1) {
      return;
    }

    const startAt = performance.now();
    const duration = 320;
    let frameId = 0;

    const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / duration);
      const easedProgress = easeOutCubic(progress);
      const currentOffset =
        startOffset + (clampedOffset - startOffset) * easedProgress;

      if (axis === "y") {
        viewport.scrollTop = currentOffset;
      } else {
        viewport.scrollLeft = currentOffset;
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  };

  const registerItem = (value: number, node: HTMLButtonElement | null) => {
    if (node) {
      itemRefs.current.set(value, node);
      return;
    }

    itemRefs.current.delete(value);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const item = itemRefs.current.get(selectedValue);

    if (!viewport || !item) {
      return;
    }

    if (isVertical) {
      const targetTop =
        item.offsetTop - viewport.clientHeight / 2 + item.clientHeight / 2;

      return animateViewportScroll(viewport, "y", targetTop);
    }

    const targetLeft =
      item.offsetLeft - viewport.clientWidth / 2 + item.clientWidth / 2;

    return animateViewportScroll(viewport, "x", targetLeft);
  }, [isVertical, selectedValue]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const firstItem = items[0] ? itemRefs.current.get(items[0].value) : null;

    if (!viewport || !firstItem) {
      return;
    }

    const updateSpacer = () => {
      const viewportSize = isVertical
        ? viewport.clientHeight
        : viewport.clientWidth;
      const itemSize = isVertical
        ? firstItem.offsetHeight
        : firstItem.offsetWidth;

      setEdgeSpacer(Math.max(0, viewportSize / 2 - itemSize / 2));
    };

    updateSpacer();

    const resizeObserver = new ResizeObserver(updateSpacer);
    resizeObserver.observe(viewport);
    resizeObserver.observe(firstItem);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVertical, items]);

  return (
    <div
      data-rail-selector="true"
      data-orientation={orientation}
      className={cn(
        "flex items-center gap-1.5 text-[0.52rem] uppercase tracking-[0.22em] text-muted-foreground sm:gap-2.5 sm:text-[0.62rem] sm:tracking-[0.3em]",
        isVertical ? "flex-row" : "flex-col",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 text-[0.54rem] font-medium sm:text-[0.56rem]",
          isVertical ? "[writing-mode:vertical-rl]" : "text-center",
        )}
      >
        {label}
      </span>

      <ScrollArea
        className={cn(
          "relative border-border/40 bg-card/30 p-1.5 backdrop-blur-sm",
          isVertical ? "h-[36vh] w-fit sm:h-[46vh]" : "w-[min(88vw,23rem)] sm:w-[min(72vw,28rem)]",
        )}
      >
        <ScrollAreaViewport
          ref={viewportRef}
          data-orientation={orientation}
          className={cn(
            "rail-selector-viewport h-full w-full",
            isVertical ? "pr-2" : "pb-2",
          )}
        >
          <div
            className={cn(
              "flex",
              isVertical ? "flex-col items-center pr-1" : "flex-row items-center",
            )}
          >
            <div
              aria-hidden="true"
              className={cn("shrink-0", isVertical ? "w-px" : "h-px")}
              style={isVertical ? { height: edgeSpacer } : { width: edgeSpacer }}
            />
            {items.map((item) => (
              <ItemComponent
                key={item.value}
                item={item}
                label={label}
                isSelected={item.value === selectedValue}
                onSelect={onSelect}
                registerItem={registerItem}
              />
            ))}
            <div
              aria-hidden="true"
              className={cn("shrink-0", isVertical ? "w-px" : "h-px")}
              style={isVertical ? { height: edgeSpacer } : { width: edgeSpacer }}
            />
          </div>
        </ScrollAreaViewport>

        <ScrollBar
          orientation={isVertical ? "vertical" : "horizontal"}
          className={cn(
            isVertical
              ? "w-2.5 border-l-transparent p-0"
              : "h-2.5 border-t-transparent p-0",
          )}
        />
      </ScrollArea>
    </div>
  );
}
