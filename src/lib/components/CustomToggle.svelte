<script lang="ts">
	interface Props {
		checked?: boolean;
		disabled?: boolean;
		label?: string;
		class?: string;
		onchange?: (checked: boolean) => void;
	}

	let { checked = false, disabled = false, label = '', class: className = '', onchange }: Props = $props();

	function toggle() {
		if (disabled) return;
		const next = !checked;
		if (onchange) onchange(next);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	{disabled}
	onclick={toggle}
	onkeydown={handleKeydown}
	class="group inline-flex items-center gap-2 cursor-pointer focus:outline-none {disabled ? 'opacity-50 cursor-not-allowed' : ''} {className}"
>
	{#if label}
		<span class="text-xs font-semibold text-neutral-300 group-hover:text-white transition select-none">
			{label}
		</span>
	{/if}

	<span
		class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-neutral-700/80 p-0.5 transition-colors duration-200 ease-in-out {checked ? 'bg-emerald-600 border-emerald-500 shadow-sm shadow-emerald-500/40' : 'bg-neutral-900 group-hover:border-neutral-600'}"
	>
		<span
			class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out {checked ? 'translate-x-4' : 'translate-x-0'}"
		></span>
	</span>
</button>
