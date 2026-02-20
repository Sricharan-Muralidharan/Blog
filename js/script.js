document.addEventListener("DOMContentLoaded", () => {
  const snippetLength = 200;
  const isLocalHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const API_BASE = window.location.port === "3000" ? "" : "http://127.0.0.1:3000";
  const DRAFT_KEY = "blogAdminDraftV1";
  const initialPosts = typeof posts !== "undefined" && Array.isArray(posts) ? posts : [];

  const state = {
    posts: [...initialPosts],
    activeTags: new Set(["All"]),
    expandedCard: null,
    editingIndex: -1,
    selectedImagePaths: [],
    selectedEditorTags: [],
  };

  const elements = {
    postsContainer: document.getElementById("posts"),
    tagControls: document.getElementById("tag-controls"),
    adminToggle: document.getElementById("admin-toggle"),
    adminPanel: document.getElementById("admin-panel"),
    editPostSelect: document.getElementById("edit-post-select"),
    postTitleInput: document.getElementById("post-title-input"),
    tagSelect: document.getElementById("tag-select"),
    addTagBtn: document.getElementById("add-tag-btn"),
    selectedTags: document.getElementById("selected-tags"),
    postEditor: document.getElementById("post-editor"),
    fontFamilySelect: document.getElementById("font-family-select"),
    fontSizeSelect: document.getElementById("font-size-select"),
    fontColorInput: document.getElementById("font-color-input"),
    postImageFile: document.getElementById("post-image-file"),
    imagePreviewList: document.getElementById("image-preview-list"),
    savePostBtn: document.getElementById("save-post-btn"),
    clearEditorBtn: document.getElementById("clear-editor-btn"),
    deletePostBtn: document.getElementById("delete-post-btn"),
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

  function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase();
  }

  function getKnownTagsMap() {
    const map = new Map();
    state.posts.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        const key = normalizeTag(tag);
        if (key && !map.has(key)) map.set(key, String(tag).trim());
      });
    });
    return map;
  }

  function dedupeTags(tags) {
    const map = getKnownTagsMap();
    const seen = new Set();
    const output = [];
    (tags || []).forEach((tag) => {
      const key = normalizeTag(tag);
      if (!key || seen.has(key)) return;
      seen.add(key);
      output.push(map.get(key) || String(tag).trim());
    });
    return output;
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

    const imageSources = Array.isArray(post.images)
      ? post.images.map((src) => String(src).trim()).filter(Boolean)
      : (post.image ? [String(post.image).trim()] : []);

    let carousel;
    if (imageSources.length > 0) {
      carousel = document.createElement("div");
      carousel.className = "post-carousel";

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "post-carousel-btn prev";
      prevBtn.setAttribute("aria-label", "Previous image");
      prevBtn.textContent = "<";

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "post-carousel-btn next";
      nextBtn.setAttribute("aria-label", "Next image");
      nextBtn.textContent = ">";

      const viewport = document.createElement("div");
      viewport.className = "post-carousel-viewport";

      const track = document.createElement("div");
      track.className = "post-carousel-track";

      imageSources.forEach((src, index) => {
        const slide = document.createElement("div");
        slide.className = "post-carousel-slide";
        if (index >= 1) slide.classList.add("with-side-bars");

        const img = document.createElement("img");
        img.src = src;
        img.alt = `${post.title} image ${index + 1}`;

        slide.appendChild(img);
        track.appendChild(slide);
      });

      viewport.appendChild(track);
      carousel.appendChild(prevBtn);
      carousel.appendChild(viewport);
      carousel.appendChild(nextBtn);

      let currentIndex = 0;
      const updateCarousel = () => {
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
      };

      const goToSlide = (direction, event) => {
        event.stopPropagation();
        if (imageSources.length < 2) return;
        currentIndex = (currentIndex + direction + imageSources.length) % imageSources.length;
        updateCarousel();
      };

      prevBtn.addEventListener("click", (event) => goToSlide(-1, event));
      nextBtn.addEventListener("click", (event) => goToSlide(1, event));

      if (imageSources.length < 2) {
        prevBtn.hidden = true;
        nextBtn.hidden = true;
      }

      updateCarousel();
    }

    card.appendChild(title);
    card.appendChild(tagList);
    card.appendChild(snippet);
    card.appendChild(fullContent);
    if (carousel) card.appendChild(carousel);

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
    elements.deletePostBtn.disabled = state.editingIndex < 0;
  }

  function renderTagDropdown() {
    const selectedValue = elements.tagSelect.value;
    const knownTags = [...getKnownTagsMap().values()].sort((a, b) => a.localeCompare(b));

    elements.tagSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a tag";
    elements.tagSelect.appendChild(defaultOption);

    knownTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      elements.tagSelect.appendChild(option);
    });

    const createOption = document.createElement("option");
    createOption.value = "__create_new__";
    createOption.textContent = "Create New Tag";
    elements.tagSelect.appendChild(createOption);

    if ([...elements.tagSelect.options].some((opt) => opt.value === selectedValue)) {
      elements.tagSelect.value = selectedValue;
    } else {
      elements.tagSelect.value = "";
    }
  }

  function renderSelectedEditorTags() {
    elements.selectedTags.innerHTML = "";
    state.selectedEditorTags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip selected-tag-chip";
      chip.textContent = `${tag} x`;
      chip.addEventListener("click", () => {
        state.selectedEditorTags = state.selectedEditorTags.filter(
          (current) => normalizeTag(current) !== normalizeTag(tag)
        );
        renderSelectedEditorTags();
        saveDraft();
      });
      elements.selectedTags.appendChild(chip);
    });
  }

  function dedupeImages(paths) {
    const seen = new Set();
    const output = [];
    (paths || []).forEach((src) => {
      const value = String(src || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      output.push(value);
    });
    return output;
  }

  function updateImagePreview() {
    elements.imagePreviewList.innerHTML = "";
    state.selectedImagePaths.forEach((src, index) => {
      const item = document.createElement("div");
      item.className = "image-preview-item";

      const img = document.createElement("img");
      img.className = "image-preview";
      img.src = src;
      img.alt = `Selected image ${index + 1}`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-image-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        state.selectedImagePaths.splice(index, 1);
        updateImagePreview();
        saveDraft();
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      elements.imagePreviewList.appendChild(item);
    });
  }

  function resetEditorFields() {
    state.editingIndex = -1;
    state.selectedImagePaths = [];
    state.selectedEditorTags = [];
    elements.postTitleInput.value = "";
    elements.postEditor.innerHTML = "";
    elements.postImageFile.value = "";
    updateImagePreview();
    renderTagDropdown();
    renderSelectedEditorTags();
    renderEditorList();
    elements.deletePostBtn.disabled = true;
    clearDraft();
  }

  function loadPostIntoEditor(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.posts.length) {
      resetEditorFields();
      return;
    }
    const post = state.posts[index];
    state.editingIndex = index;
    state.selectedImagePaths = dedupeImages(
      Array.isArray(post.images) ? post.images : (post.image ? [post.image] : [])
    );
    state.selectedEditorTags = dedupeTags(post.tags || []);
    elements.postTitleInput.value = post.title || "";
    elements.postEditor.innerHTML = getPostHtml(post);
    updateImagePreview();
    renderTagDropdown();
    renderSelectedEditorTags();
    renderEditorList();
    elements.deletePostBtn.disabled = state.editingIndex < 0;
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
    state.selectedImagePaths = dedupeImages([...state.selectedImagePaths, result.imagePath]);
    updateImagePreview();
    saveDraft();
  }

  function saveDraft() {
    if (!isLocalHost) return;
    const draft = {
      editingIndex: state.editingIndex,
      title: elements.postTitleInput.value,
      contentHtml: elements.postEditor.innerHTML,
      tags: state.selectedEditorTags,
      images: state.selectedImagePaths,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function clearDraft() {
    if (!isLocalHost) return;
    localStorage.removeItem(DRAFT_KEY);
  }

  function loadDraft() {
    if (!isLocalHost) return;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      state.editingIndex = Number.isInteger(draft.editingIndex) ? draft.editingIndex : -1;
      state.selectedImagePaths = dedupeImages(
        Array.isArray(draft.images) ? draft.images : (draft.image ? [draft.image] : [])
      );
      state.selectedEditorTags = dedupeTags(Array.isArray(draft.tags) ? draft.tags : []);
      elements.postTitleInput.value = String(draft.title || "");
      elements.postEditor.innerHTML = String(draft.contentHtml || "");
      updateImagePreview();
      renderTagDropdown();
      renderSelectedEditorTags();
      renderEditorList();
    } catch {
      clearDraft();
    }
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

    elements.deletePostBtn.addEventListener("click", async () => {
      if (state.editingIndex < 0) return;
      const postToDelete = state.posts[state.editingIndex];
      const ok = window.confirm(`Delete post "${postToDelete?.title || "this post"}"? This cannot be undone.`);
      if (!ok) return;

      try {
        const result = await apiJson("/api/delete-post", { index: state.editingIndex });
        state.posts = result.posts;
        state.activeTags = new Set(["All"]);
        clearDraft();
        resetEditorFields();
        renderTagButtons();
        renderPosts();
        renderTagDropdown();
        renderSelectedEditorTags();
        renderEditorList();
        window.alert("Post deleted.");
      } catch (error) {
        window.alert(`Delete failed: ${error.message}`);
      }
    });

    elements.addTagBtn.addEventListener("click", () => {
      let selected = elements.tagSelect.value;
      if (!selected) return;

      if (selected === "__create_new__") {
        const newTagInput = window.prompt("Enter new tag name:");
        if (!newTagInput) {
          elements.tagSelect.value = "";
          return;
        }
        selected = newTagInput.trim();
      }

      const normalized = normalizeTag(selected);
      if (!normalized) return;

      const knownMap = getKnownTagsMap();
      const canonical = knownMap.get(normalized) || selected;
      const exists = state.selectedEditorTags.some(
        (tag) => normalizeTag(tag) === normalized
      );
      if (!exists) state.selectedEditorTags.push(canonical);

      state.selectedEditorTags = dedupeTags(state.selectedEditorTags);
      renderTagDropdown();
      renderSelectedEditorTags();
      elements.tagSelect.value = "";
      saveDraft();
    });

    elements.postImageFile.addEventListener("change", async (event) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (files.length === 0) return;
      for (const file of files) {
        try {
          await uploadImageFile(file);
        } catch (error) {
          window.alert(error.message);
          break;
        }
      }
      elements.postImageFile.value = "";
    });

    elements.postEditor.addEventListener("paste", async (event) => {
      if (elements.adminPanel.hidden) return;
      const items = event.clipboardData ? event.clipboardData.items : [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        event.stopPropagation();
        try {
          await uploadImageFile(file);
        } catch (error) {
          window.alert(error.message);
        }
        break;
      }
    });

    elements.postTitleInput.addEventListener("input", saveDraft);
    elements.postEditor.addEventListener("input", saveDraft);

    elements.savePostBtn.addEventListener("click", async () => {
      const title = elements.postTitleInput.value.trim();
      const contentHtml = elements.postEditor.innerHTML.trim();
      const contentText = textFromHtml(contentHtml);
      const tags = dedupeTags(state.selectedEditorTags);

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
            image: state.selectedImagePaths[0] || "",
            images: state.selectedImagePaths,
            tags,
          },
          index: state.editingIndex >= 0 ? state.editingIndex : undefined,
        };

        const result = await apiJson("/api/save-post", payload);
        state.posts = result.posts;
        state.activeTags = new Set(["All"]);
        state.selectedEditorTags = dedupeTags(state.selectedEditorTags);
        renderTagButtons();
        renderPosts();
        renderTagDropdown();
        renderSelectedEditorTags();
        renderEditorList();
        clearDraft();
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
    renderTagDropdown();
    renderSelectedEditorTags();
    renderEditorList();
    updateImagePreview();
    loadDraft();
  });
});
