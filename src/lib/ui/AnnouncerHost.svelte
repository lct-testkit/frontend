<script lang="ts">
	// The two live regions that `announce()` writes into: a status (polite) and an alert (assertive). Mounted once in the root layout.
	import { announcements } from './announcer.svelte';
	import { loadingAnnouncement } from './skeleton-count.svelte';
</script>

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcements.polite}</div>
<div class="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{announcements.assertive}</div>
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{loadingAnnouncement.text}</div>
