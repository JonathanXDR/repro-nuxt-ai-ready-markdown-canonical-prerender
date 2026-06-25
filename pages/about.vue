<script setup lang="ts">
useSeoMeta({
  title: 'About',
  description: 'Canonical HTML about page that should prerender to about/index.html.',
})
</script>

<template>
  <main>
    <h1>About</h1>
    <p>
      This page is prerendered to <code>about/index.html</code>. A correct
      prerender produces a full HTML document, not a redirect to the markdown
      twin.
    </p>
  </main>
</template>
