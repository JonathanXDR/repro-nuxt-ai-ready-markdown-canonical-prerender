<script setup lang="ts">
useSeoMeta({
  title: 'Home',
  description: 'Canonical HTML home page that should prerender to index.html.',
})
</script>

<template>
  <main>
    <h1>Home</h1>
    <p>
      This page is prerendered to <code>index.html</code>. A correct prerender
      produces a full HTML document. Visit the
      <NuxtLink to="/about/">about page</NuxtLink> as well.
    </p>
  </main>
</template>
