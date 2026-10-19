<script lang="ts" setup>
/**
 * Chat screen modelled on the ChatGPT mobile app.
 *
 * Layout (top to bottom):
 *  - A minimal white header with the model name and a connection indicator.
 *  - A scrollable message list (AI text is full width, user messages are
 *    right-aligned grey pills).
 *  - A composer with a rounded input and a circular send button.
 *
 * The native ActionBar is hidden in favour of a custom header so the layout
 * can match the ChatGPT app more closely.
 */
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useChatStore } from '../stores/chat';
import { omniRoute, type OmniRouteModel } from '../services/omniroute';
import ChatMessage from './ChatMessage.vue';

const chatStore = useChatStore();
const userInput = ref('');
const messageList = ref(null);

const models = ref<OmniRouteModel[]>([]);
const showModelPicker = ref(false);
const loadingModels = ref(false);
const modelFilter = ref('');

/** Models matching the current search term. */
const filteredModels = computed(() => {
  const term = modelFilter.value.trim().toLowerCase();
  if (!term) {
    return models.value;
  }
  return models.value.filter((model) => model.id.toLowerCase().includes(term));
});

let unsubscribeStatus: (() => void) | undefined;

onMounted(async () => {
  unsubscribeStatus = omniRoute.onStatus((status) => {
    chatStore.setConnectionStatus(status === 'connected');
  });

  // Probe the gateway so the header shows the real connection state.
  try {
    models.value = await omniRoute.loadModels();
  } catch (err) {
    console.error('Could not load models:', err);
  }
});

onUnmounted(() => {
  unsubscribeStatus?.();
});

function scrollToBottom() {
  nextTick(() => {
    const list = messageList.value as any;
    if (list?.scrollToIndex) {
      list.scrollToIndex(chatStore.messages.length - 1, true);
    }
  });
}

async function openModelPicker() {
  showModelPicker.value = true;
  if (models.value.length) {
    return;
  }
  loadingModels.value = true;
  try {
    models.value = await omniRoute.loadModels(true);
  } catch (err) {
    console.error('Could not load models:', err);
  } finally {
    loadingModels.value = false;
  }
}

function closeModelPicker() {
  showModelPicker.value = false;
}

function selectModel(model: OmniRouteModel) {
  chatStore.setModel(model.id);
  closeModelPicker();
}

function currentModelLabel(): string {
  const selected = models.value.find((m) => m.id === chatStore.model);
  if (selected) {
    // Show a short, friendly label: "provider/model" -> "model"
    const parts = selected.id.split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : selected.id;
  }
  return chatStore.model;
}
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || chatStore.isTyping) {
    return;
  }

  userInput.value = '';
  chatStore.addMessage(text, 'user');
  chatStore.setTypingStatus(true);
  scrollToBottom();

  const history = chatStore.buildHistory(
    'You are a helpful assistant. Answer concisely and use Markdown.',
  );

  try {
    const reply = await omniRoute.sendChat(history, chatStore.model);
    chatStore.setTypingStatus(false);

    if (reply && reply.trim()) {
      chatStore.addMessage(reply, 'ai');
    } else {
      chatStore.addMessage('(empty response)', 'ai', true);
    }
    scrollToBottom();
  } catch (error) {
    chatStore.setTypingStatus(false);
    const message =
      error instanceof Error ? error.message : 'Unknown error while contacting OmniRoute.';
    chatStore.addMessage(message, 'ai', true);
    scrollToBottom();
  }
}
</script>

<template>
  <Frame>
    <Page actionBarHidden="true">
      <GridLayout rows="auto, *, auto" class="page-root">
        <!-- ============ Header ============ -->
        <GridLayout row="0" columns="auto, *, auto" class="header">
          <Label col="0" text="☰" class="header-icon" />

          <!-- Tapping the title opens the model picker. -->
          <StackLayout col="1" vertical-align="center" @tap="openModelPicker">
            <Label :text="currentModelLabel()" class="header-title" />
            <Label
              :text="chatStore.isConnected ? 'Connected' : 'Connecting…'"
              class="header-status"
            />
          </StackLayout>

          <Label col="2" text="✎" class="header-icon" @tap="closeModelPicker" />
        </GridLayout>

        <!-- ============ Messages ============ -->
        <ScrollView row="1" class="message-scroll">
          <StackLayout ref="messageList" class="message-list">
            <ChatMessage
              v-for="(message, index) in chatStore.messages"
              :key="index"
              :text="message.text"
              :sender="message.sender"
              :timestamp="message.timestamp"
              :is-error="message.isError"
            />

            <!-- Typing indicator (ChatGPT shows three pulsing dots) -->
            <GridLayout
              v-if="chatStore.isTyping"
              columns="auto, *"
              class="typing-row"
            >
              <StackLayout col="0" orientation="horizontal" class="typing-bubble">
                <Label text="•" class="dot" />
                <Label text="•" class="dot" />
                <Label text="•" class="dot" />
              </StackLayout>
            </GridLayout>
          </StackLayout>
        </ScrollView>

        <!-- ============ Model picker (modal sheet) ============ -->
        <!--
          The overlay spans all three rows of the page grid (rowSpan="3")
          so it covers the header, the messages and the composer.
        -->
        <GridLayout
          v-if="showModelPicker"
          row="0"
          rowSpan="3"
          columns="*, auto"
          class="modal-backdrop"
          @tap="closeModelPicker"
        >
          <GridLayout
            col="0"
            rows="auto, auto, *"
            class="modal-sheet"
            @tap="() => {}"
          >
            <GridLayout row="0" columns="*, auto" class="modal-header">
              <Label col="0" text="Select a model" class="modal-title" />
              <Label col="1" text="✕" class="modal-close" @tap="closeModelPicker" />
            </GridLayout>

            <!-- Search box: OmniRoute exposes several hundred models. -->
            <TextField
              row="1"
              v-model="modelFilter"
              hint="Search models"
              class="model-search"
            />

            <StackLayout
              v-if="loadingModels || (!filteredModels.length && models.length)"
              row="2"
              class="modal-loading"
            >
              <Label
                :text="loadingModels ? 'Loading models…' : 'No model matches your search.'"
                class="modal-loading-text"
              />
            </StackLayout>

            <!--
              A ListView is used instead of a ScrollView because OmniRoute
              exposes several hundred models - ListView recycles the rows
              instead of laying out every Label at once.
            -->
            <ListView
              v-else
              row="2"
              class="modal-list"
              :items="filteredModels"
            >
              <template #default="{ item: model }">
                <Label
                  :text="model.id"
                  textWrap="true"
                  class="model-item"
                  :class="{ 'model-item--active': model.id === chatStore.model }"
                  @tap="selectModel(model)"
                />
              </template>
            </ListView>
          </GridLayout>
        </GridLayout>

        <!-- ============ Composer ============ -->
        <GridLayout row="2" columns="*, auto" class="composer">
          <TextField
            col="0"
            v-model="userInput"
            hint="Message Omniroute AI"
            class="composer-input"
            returnKeyType="send"
            @submit="sendMessage"
          />
          <Button
            col="1"
            text="↑"
            class="send-button"
            :class="{ 'send-button--disabled': !userInput.trim() }"
            @tap="sendMessage"
          />
        </GridLayout>
      </GridLayout>
    </Page>
  </Frame>
</template>

<style scoped>
.page-root {
  background-color: #ffffff;
}

/* ---------- Header ---------- */
.header {
  background-color: #ffffff;
  border-bottom-width: 1;
  border-bottom-color: #e5e5e5;
  padding: 10 12;
  horizontal-align: stretch;
}

.header-icon {
  color: #0d0d0d;
  font-size: 20;
  width: 32;
  text-align: center;
  vertical-align: center;
}

.header-title {
  color: #0d0d0d;
  font-size: 16;
  font-weight: 600;
  text-align: center;
}

.header-status {
  color: #8f8f8f;
  font-size: 11;
  text-align: center;
}

/* ---------- Messages ---------- */
.message-scroll {
  background-color: #ffffff;
}

.message-list {
  padding-bottom: 8;
}

/* ---------- Typing indicator ---------- */
.typing-row {
  padding: 0 12 4 12;
}

.typing-bubble {
  background-color: #f0f0f0;
  border-radius: 20;
  padding: 12 14;
  horizontal-align: left;
}

.dot {
  color: #8f8f8f;
  font-size: 18;
  line-height: 14;
  padding: 0 3;
}

/* ---------- Model picker ---------- */
.modal-backdrop {
  background-color: rgba(0, 0, 0, 0.35);
  horizontal-align: stretch;
  vertical-align: stretch;
}

.modal-sheet {
  background-color: #ffffff;
  border-top-left-radius: 16;
  border-top-right-radius: 16;
  padding: 12;
  margin: 12;
  /* Bottom sheet: full width, 60% of the screen, anchored to the bottom. */
  horizontal-align: stretch;
  vertical-align: bottom;
  height: 60%;
}

.modal-header {
  padding-bottom: 8;
  border-bottom-width: 1;
  border-bottom-color: #e5e5e5;
}

.modal-title {
  color: #0d0d0d;
  font-size: 16;
  font-weight: 600;
  vertical-align: center;
}

.modal-close {
  color: #8f8f8f;
  font-size: 18;
  width: 28;
  text-align: center;
}

.model-search {
  background-color: #f4f4f4;
  color: #0d0d0d;
  border-radius: 16;
  border-width: 0;
  font-size: 14;
  padding: 8 12;
  margin: 8 0;
}

.modal-list {
  margin-top: 4;
}

.modal-loading {
  padding: 16;
}

.modal-loading-text {
  color: #8f8f8f;
  font-size: 14;
  text-align: center;
}

.model-item {
  color: #0d0d0d;
  font-size: 14;
  padding: 10 8;
}

.model-item--active {
  color: #0d6efd;
  font-weight: 600;
}

/* ---------- Composer ---------- */
.composer {
  background-color: #ffffff;
  border-top-width: 1;
  border-top-color: #e5e5e5;
  padding: 8;
  horizontal-align: stretch;
}

.composer-input {
  background-color: #f4f4f4;
  color: #0d0d0d;
  border-radius: 24;
  border-width: 0;
  font-size: 15;
  padding: 10 16;
  margin-right: 8;
  vertical-align: center;
}

.send-button {
  width: 36;
  height: 36;
  border-radius: 18;
  background-color: #0d0d0d;
  color: #ffffff;
  font-size: 18;
  font-weight: 700;
  horizontal-align: right;
  vertical-align: center;
  padding: 0;
  margin: 0;
}

.send-button--disabled {
  background-color: #d4d4d4;
}
</style>
