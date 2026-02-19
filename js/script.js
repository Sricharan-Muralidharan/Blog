document.addEventListener("DOMContentLoaded", () => {
  const postsContainer = document.getElementById("posts");
  const tagControls = document.getElementById("tag-controls");
  const allTags = [...new Set(posts.flatMap(post => post.tags || []))];
  const snippetLength = 200;
  let activeTags = new Set(["All"]);
  let expandedCard = null;

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
    snippet.className = "post-snippet";
    snippet.textContent = post.content.length > snippetLength
      ? `${post.content.substring(0, snippetLength)}...`
      : post.content;

    const fullContent = document.createElement("p");
    fullContent.className = "post-full-content";
    fullContent.textContent = post.content;
    fullContent.style.display = "none";

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
      if (expandedCard && expandedCard !== card) {
        expandedCard.classList.remove("full");
        const prevFull = expandedCard.querySelector(".post-full-content");
        const prevSnippet = expandedCard.querySelector(".post-snippet");
        if (prevFull) prevFull.style.display = "none";
        if (prevSnippet) prevSnippet.style.display = "block";
      }

      const isExpanded = !card.classList.contains("full");
      card.classList.toggle("full", isExpanded);
      fullContent.style.display = isExpanded ? "block" : "none";
      snippet.style.display = isExpanded ? "none" : "block";
      expandedCard = isExpanded ? card : null;
    });

    return card;
  }

  function renderPosts() {
    postsContainer.innerHTML = "";
    expandedCard = null;
    const visiblePosts = activeTags.has("All")
      ? posts
      : posts.filter(post => (post.tags || []).some(tag => activeTags.has(tag)));

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
      if (activeTags.has(tag)) button.classList.add("active");
      button.type = "button";
      button.textContent = tag;
      button.addEventListener("click", () => {
        if (tag === "All") {
          activeTags = new Set(["All"]);
        } else {
          if (activeTags.has("All")) activeTags.delete("All");

          if (activeTags.has(tag)) {
            activeTags.delete(tag);
          } else {
            activeTags.add(tag);
          }

          if (activeTags.size === 0) activeTags.add("All");
        }

        renderTagButtons();
        renderPosts();
      });
      tagControls.appendChild(button);
    });
  }

  renderTagButtons();
  renderPosts();
});
