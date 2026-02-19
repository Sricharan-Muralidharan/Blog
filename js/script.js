document.addEventListener("DOMContentLoaded", () => {
  const postsContainer = document.getElementById("posts");
  const tagControls = document.getElementById("tag-controls");
  const allTags = [...new Set(posts.flatMap(post => post.tags || []))];
  let activeTag = "All";

  function createCard(post) {
    const card = document.createElement("article");
    card.className = "post-card";

    const title = document.createElement("h2");
    title.textContent = post.title;

    const tagList = document.createElement("div");
    tagList.className = "post-tags";
    (post.tags || []).forEach(tag => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      tagList.appendChild(chip);
    });

    const snippet = document.createElement("p");
    snippet.textContent = post.content.substring(0, 50) + "..."; // auto snippet

    const fullContent = document.createElement("p");
    fullContent.textContent = post.content;
    fullContent.style.display = "none";

    const img = document.createElement("img");
    img.src = post.image;
    img.alt = post.title;

    card.appendChild(title);
    card.appendChild(tagList);
    card.appendChild(snippet);
    card.appendChild(fullContent);
    card.appendChild(img);

    card.addEventListener("click", () => {
      const isExpanded = card.classList.toggle("full");
      fullContent.style.display = isExpanded ? "block" : "none";
      snippet.style.display = isExpanded ? "none" : "block";
    });

    return card;
  }

  function renderPosts() {
    postsContainer.innerHTML = "";
    const visiblePosts = activeTag === "All"
      ? posts
      : posts.filter(post => (post.tags || []).includes(activeTag));

    visiblePosts.forEach(post => {
      postsContainer.appendChild(createCard(post));
    });
  }

  function renderTagButtons() {
    tagControls.innerHTML = "";
    const tags = ["All", ...allTags];
    tags.forEach(tag => {
      const button = document.createElement("button");
      button.className = "filter-chip";
      if (tag === activeTag) button.classList.add("active");
      button.type = "button";
      button.textContent = tag;
      button.addEventListener("click", () => {
        activeTag = tag;
        renderTagButtons();
        renderPosts();
      });
      tagControls.appendChild(button);
    });
  }

  renderTagButtons();
  renderPosts();
});
