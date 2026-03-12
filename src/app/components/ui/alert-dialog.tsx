"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn, generateModalId, openModalStack, isProgrammaticBack, setProgrammaticBack } from "./utils";
import { buttonVariants } from "./button";

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

function AlertDialog({
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  const handleClose = useBackHandler(open ?? false, onOpenChange);
  
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" open={open} onOpenChange={handleClose} {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-3xl border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
