"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn, generateModalId, openModalStack, isProgrammaticBack, setProgrammaticBack } from "./utils";

// 모바일 뒤로가기 버튼 지원을 위한 커스텀 훅 (공유 스택 사용)
function useBackHandler(open: boolean, onOpenChange?: (open: boolean) => void) {
  const wasOpenRef = React.useRef(false);
  const modalIdRef = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      // 모달이 열릴 때 고유 ID 생성 및 스택에 추가
      modalIdRef.current = generateModalId();
      openModalStack.push(modalIdRef.current);
      window.history.pushState({ modalId: modalIdRef.current }, "");
      wasOpenRef.current = true;
    } else if (!open && wasOpenRef.current) {
      // 스택에서 제거
      if (modalIdRef.current) {
        const idx = openModalStack.indexOf(modalIdRef.current);
        if (idx !== -1) openModalStack.splice(idx, 1);
      }
      wasOpenRef.current = false;
      modalIdRef.current = null;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const handlePopState = (e: PopStateEvent) => {
      // 프로그래밍적으로 호출된 back()은 무시
      if (isProgrammaticBack) {
        setProgrammaticBack(false);
        return;
      }
      
      // 뒤로가기 버튼이 눌렸을 때
      // 스택의 맨 위(가장 최근에 열린 모달)만 닫기
      if (wasOpenRef.current && modalIdRef.current) {
        const topModalId = openModalStack[openModalStack.length - 1];
        if (topModalId === modalIdRef.current) {
          // 스택에서 제거
          openModalStack.pop();
          wasOpenRef.current = false;
          modalIdRef.current = null;
          onOpenChange?.(false);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open, onOpenChange]);

  // X 버튼이나 오버레이 클릭으로 닫힐 때 히스토리 정리
  const handleClose = React.useCallback((newOpen: boolean) => {
    if (!newOpen && wasOpenRef.current && modalIdRef.current) {
      // 스택의 맨 위인지 확인
      const topModalId = openModalStack[openModalStack.length - 1];
      if (topModalId === modalIdRef.current) {
        // 스택에서 제거
        openModalStack.pop();
        wasOpenRef.current = false;
        modalIdRef.current = null;
        // 프로그래밍적 back 표시 후 history.back() 호출
        setProgrammaticBack(true);
        window.history.back();
      }
    }
    onOpenChange?.(newOpen);
  }, [onOpenChange]);

  return handleClose;
}

function Sheet({ open, onOpenChange, ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const handleClose = useBackHandler(open ?? false, onOpenChange);
  
  return <SheetPrimitive.Root data-slot="sheet" open={open} onOpenChange={handleClose} {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l rounded-l-3xl sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r rounded-r-3xl sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b rounded-b-3xl",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t rounded-t-3xl",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
