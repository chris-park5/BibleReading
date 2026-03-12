"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn, generateModalId, openModalStack, isProgrammaticBack, setProgrammaticBack } from "./utils";

// 모바일 뒤로가기 버튼 지원을 위한 커스텀 훅
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

function Dialog({
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const handleClose = useBackHandler(open ?? false, onOpenChange);
  
  return <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={handleClose} {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal data-slot="dialog-portal">
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      className={cn(
        "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-3xl border p-6 shadow-lg duration-200 sm:max-w-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
        <XIcon />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn("text-lg leading-none font-semibold", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
