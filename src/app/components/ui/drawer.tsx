"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

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

function Drawer({
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const handleClose = useBackHandler(open ?? false, onOpenChange);
  
  return <DrawerPrimitive.Root data-slot="drawer" open={open} onOpenChange={handleClose} {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content bg-background fixed z-50 flex h-auto flex-col",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-3xl data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-3xl data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:rounded-l-3xl data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:rounded-r-3xl data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
