document.addEventListener("DOMContentLoaded", () => {
  const snippetLength = 200;
  const isLocalHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const API_BASE = window.location.port === "3000" ? "" : "http://127.0.0.1:3000";
  const initialPosts = typeof posts !== "undefined" && Array.isArray(posts) ? posts : [];

  const state = {
    posts: [...initialPosts],
    activeTags: new Set(["All"]),
    expandedCard: null,
    editingIndex: -1,
    selectedImagePath: "",
  };

  const elements = {
    postsContainer: document.getElementById("posts"),
    tagControls: document.getElementById("tag-controls"),
    adminToggle: document.getElementById("admin-toggle"),
    adminPanel: document.getElementById("admin-panel"),
    editPostSelect: document.getElementById("edit-post-select"),
    postTitleInput: document.getElementById("post-title-input"),
    postTagsInput: document.getElementById("post-tags-input"),
    postEditor: document.getElementById("post-editor"),
    fontFamilySelect: document.getElementById("font-family-select"),
    fontSizeSelect: document.getElementById("font-size-select"),
    fontColorInput: document.getElementById("font-color-input"),
    postImageFile: document.getElementById("post-image-file"),
    imagePreview: document.getElementById("image-preview"),
    savePostBtn: document.getElementById("save-post-btn"),
    clearEditorBtn: document.getElementById("clear-editor-btn"),
    toolbar: document.querySelector(".editor-toolbar"),
  };

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function textFromHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    return (temp.textContent || "").trim();
  }

  function getPostHtml(post) {
    if (post.contentHtml) return post.contentHtml;
    return escapeHtml(post.content || "").replace(/\n/g, "<br>");
  }

  function getPostText(post) {
    if (post.content && String(post.content).trim()) return String(post.content).trim();
    if (post.contentHtml) return textFromHtml(post.contentHtml);
    return "";
  }

  function createCard(post) {
    const card = document.createElement("article");
    card.className = "post-card";

    const title = document.createElement("h2");
    title.textContent = post.title;

    const tagList = document.createElement("div");
    tagList.className = "post-tags";
    (post.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      tagList.appendChild(chip);
    });

    const fullText = getPostText(post);
    const snippet = document.createElement("p");
    snippet.className = "post-snippet";
    snippet.textContent = fullText.length > snippetLength
      ? `${fullText.substring(0, snippetLength)}...`
      : fullText;

    const fullContent = document.createElement("div");
    fullContent.className = "post-full-content";
    fullContent.innerHTML = getPostHtml(post);

    let img;
    if (post.image) {
      img = document.createElement("img");
      img.src = post.image;
      img.alt = post.title;
    }

    card.appendChild(title);
    card.appendChild(tagList);
    card.appendChild(snippet);
    card.appendChild(fullContent);
    if (img) card.appendChild(img);

    card.addEventListener("click", () => {
      if (state.expandedCard && state.expandedCard !== card) {
        state.expandedCard.classList.remove("full");
      }

      const isExpanded = !card.classList.contains("full");
      card.classList.toggle("full", isExpanded);
      state.expandedCard = isExpanded ? card : null;
    });

    return card;
  }

  function renderPosts() {
    elements.postsContainer.innerHTML = "";
    state.expandedCard = null;
    const visiblePosts = state.activeTags.has("All")
      ? state.posts
      : state.posts.filter((post) => (post.tags || []).some((tag) => state.activeTags.has(tag)));

    visiblePosts.forEach((post) => {
      elements.postsContainer.appendChild(createCard(post));
    });
  }

  function renderTagButtons() {
    elements.tagControls.innerHTML = "";
    const allTags = [...new Set(state.posts.flatMap((post) => post.tags || []))];
    const tags = ["All", ...allTags];

    tags.forEach((tag) => {
      const button = document.createElement("button");
      button.className = "filter-chip";
      if (state.activeTags.has(tag)) button.classList.add("active");
      button.type = "button";
      button.textContent = tag;
      button.addEventListener("click", () => {
        if (tag === "All") {
          state.activeTags = new Set(["All"]);
        } else {
          if (state.activeTags.has("All")) state.activeTags.delete("All");
          if (state.activeTags.has(tag)) {
            state.activeTags.delete(tag);
          } else {
            state.activeTags.add(tag);
          }
          if (state.activeTags.size === 0) state.activeTags.add("All");
        }
        renderTagButtons();
        renderPosts();
      });
      elements.tagControls.appendChild(button);
    });
  }

  function renderEditorList() {
    elements.editPostSelect.innerHTML = '<option value="-1">Create New Post</option>';
    state.posts.forEach((post, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${post.title}`;
      elements.editPostSelect.appendChild(option);
    });
    elements.editPostSelect.value = String(state.editingIndex);
  }

  function updateImagePreview() {
    if (state.selectedImagePath) {
      elements.imagePreview.src = state.selectedImagePath;
      elements.imagePreview.hidden = false;
    } else {
      elements.imagePreview.removeAttribute("src");
      elements.imagePreview.hidden = true;
    }
  }

  function resetEditorFields() {
    state.editingIndex = -1;
    state.selectedImagePath = "";
    elements.postTitleInput.value = "";
    elements.postTagsInput.value = "";
    elements.postEditor.innerHTML = "";
    elements.postImageFile.value = "";
    updateImagePreview();
    renderEditorList();
  }

  function loadPostIntoEditor(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.posts.length) {
      resetEditorFields();
      return;
    }
    const post = state.posts[index];
    state.editingIndex = index;
    state.selectedImagePath = post.image || "";
    elements.postTitleInput.value = post.title || "";
    elements.postTagsInput.value = (post.tags || []).join(", ");
    elements.postEditor.innerHTML = getPostHtml(post);
    updateImagePreview();
    renderEditorList();
  }

  async function apiJson(url, payload) {
    const response = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }
    }

    if (!response.ok) {
      if (response.status === 405) {
        throw new Error("Method not allowed on current server. Start the app with 'npm start' and open http://127.0.0.1:3000");
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    if (!raw) {
      throw new Error("Server returned an empty response");
    }
    return data;
  }

  async function uploadImageFile(file) {
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
    const result = await apiJson("/api/upload-image", {
      dataUrl,
      filename: file.name,
    });
    state.selectedImagePath = result.imagePath;
    updateImagePreview();
  }

  function setupEditorToolbar() {
    elements.toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-command]");
      if (!button) return;
      const command = button.dataset.command;
      document.execCommand(command, false);
      elements.postEditor.focus();
    });

    elements.fontFamilySelect.addEventListener("change", () => {
      document.execCommand("fontName", false, elements.fontFamilySelect.value);
      elements.postEditor.focus();
    });

    elements.fontSizeSelect.addEventListener("change", () => {
      document.execCommand("fontSize", false, elements.fontSizeSelect.value);
      elements.postEditor.focus();
    });

    elements.fontColorInput.addEventListener("input", () => {
      document.execCommand("foreColor", false, elements.fontColorInput.value);
      elements.postEditor.focus();
    });
  }

  function setupAdminInteractions() {
    if (!isLocalHost) {
      elements.adminToggle.style.display = "none";
      elements.adminPanel.hidden = true;
      return;
    }

    elements.adminToggle.addEventListener("click", () => {
      const isHidden = elements.adminPanel.hidden;
      elements.adminPanel.hidden = !isHidden;
      if (!elements.adminPanel.hidden) {
        renderEditorList();
      }
    });

    elements.editPostSelect.addEventListener("change", () => {
      const index = Number(elements.editPostSelect.value);
      loadPostIntoEditor(index);
    });

    elements.clearEditorBtn.addEventListener("click", () => {
      resetEditorFields();
    });

    elements.postImageFile.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        await uploadImageFile(file);
      } catch (error) {
        window.alert(error.message);
      }
    });

    document.addEventListener("paste", async (event) => {
      if (elements.adminPanel.hidden) return;
      const items = event.clipboardData ? event.clipboardData.items : [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        try {
          await uploadImageFile(file);
        } catch (error) {
          window.alert(error.message);
        }
        break;
      }
    });

    elements.savePostBtn.addEventListener("click", async () => {
      const title = elements.postTitleInput.value.trim();
      const contentHtml = elements.postEditor.innerHTML.trim();
      const contentText = textFromHtml(contentHtml);
      const tags = elements.postTagsInput.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (!title || !contentText) {
        window.alert("Title and post content are required.");
        return;
      }

      try {
        const payload = {
          post: {
            title,
            content: contentText,
            contentHtml,
            image: state.selectedImagePath,
            tags,
          },
          index: state.editingIndex >= 0 ? state.editingIndex : undefined,
        };

        const result = await apiJson("/api/save-post", payload);
        state.posts = result.posts;
        state.activeTags = new Set(["All"]);
        renderTagButtons();
        renderPosts();
        renderEditorList();
        if (state.editingIndex < 0) resetEditorFields();
        window.alert("Post saved.");
      } catch (error) {
        window.alert(`Save failed: ${error.message}`);
      }
    });
  }

  async function loadPostsFromServer() {
    try {
      const response = await fetch(`${API_BASE}/api/posts`, { method: "GET" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.posts)) {
        state.posts = data.posts;
      }
    } catch {
      // Static fallback keeps initial posts from posts.js
    }
  }

  setupEditorToolbar();
  setupAdminInteractions();

  loadPostsFromServer().finally(() => {
    renderTagButtons();
    renderPosts();
    renderEditorList();
    updateImagePreview();
  });
});
