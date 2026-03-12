import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 모달 뒤로가기 버튼 지원을 위한 공유 스택
let modalIdCounter = 0;
export const generateModalId = () => `modal-${++modalIdCounter}-${Date.now()}`;
export const openModalStack: string[] = [];

// 프로그래밍적으로 호출된 history.back()인지 여부
export let isProgrammaticBack = false;
export const setProgrammaticBack = (value: boolean) => { isProgrammaticBack = value; };
