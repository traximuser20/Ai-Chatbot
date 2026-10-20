<script lang="ts" setup">
/**
 * TEMPORARY diagnostic - exercises NativeScript's fetch against OmniRoute
 * to see the underlying error.
 */
import { onMounted } from 'vue';

const URL = 'http://10.0.2.2:20128/v1/models';
const KEY = 'sk-cf2c8acbccfc179f-443d10-95acbd1b';

onMounted(async () => {
  console.log('DIAG typeof fetch =', typeof fetch);

  try {
    const res = await fetch(URL, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    console.log('DIAG status =', res.status, 'ok =', res.ok);
    const body = await res.text();
    console.log('DIAG body len =', body.length);
  } catch (e: any) {
    console.log('DIAG fetch error:', e && e.message ? e.message : String(e));
    console.log('DIAG error name:', e && e.name);
    console.log('DIAG stack:', e && e.stack ? String(e.stack).slice(0, 400) : 'none');
  }

  // Also try XMLHttpRequest directly, since fetch is built on it.
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', URL);
      xhr.setRequestHeader('Authorization', `Bearer ${KEY}`);
      xhr.onload = () => {
        console.log('DIAG xhr status =', xhr.status, 'len =', xhr.responseText.length);
        resolve();
      };
      xhr.onerror = (e: any) => {
        console.log('DIAG xhr error:', JSON.stringify(e && e.message ? e.message : e));
        reject(new Error('xhr'));
      };
      xhr.send();
    });
  } catch {
    console.log('DIAG xhr path failed');
  }
});
</script>

<template>
  <Label text="diagnostic" />
</template>
