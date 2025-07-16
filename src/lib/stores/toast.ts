import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	description?: string;
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	
	function add(toast: Omit<Toast, 'id'>) {
		const id = Math.random().toString(36).substring(2, 9);
		const duration = toast.duration ?? 5000;
		
		update(toasts => [...toasts, { ...toast, id }]);
		
		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}
		
		return id;
	}
	
	function remove(id: string) {
		update(toasts => toasts.filter(t => t.id !== id));
	}
	
	function success(title: string, description?: string) {
		return add({ type: 'success', title, description });
	}
	
	function error(title: string, description?: string) {
		return add({ type: 'error', title, description });
	}
	
	function warning(title: string, description?: string) {
		return add({ type: 'warning', title, description });
	}
	
	function info(title: string, description?: string) {
		return add({ type: 'info', title, description });
	}
	
	return {
		subscribe,
		add,
		remove,
		success,
		error,
		warning,
		info
	};
}

export const toast = createToastStore();