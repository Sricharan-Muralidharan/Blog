document.addEventListener("DOMContentLoaded", () => {
  const postsContainer = document.getElementById("posts");

  posts.forEach(post => {
    const card = document.createElement("div");
    card.className = "post-card";

    const title = document.createElement("h2");
    title.textContent = post.title;

    const snippet = document.createElement("p");
    snippet.textContent = post.content.substring(0, 50) + "..."; // auto snippet

    const fullContent = document.createElement("p");
    fullContent.textContent = post.content;
    fullContent.style.display = "none";

    const img = document.createElement("img");
    img.src = post.image;
    img.alt = post.title;

    card.appendChild(title);
    card.appendChild(snippet);
    card.appendChild(fullContent);
    card.appendChild(img);

    card.addEventListener("click", () => {
      const isExpanded = card.classList.toggle("full");
      fullContent.style.display = isExpanded ? "block" : "none";
      snippet.style.display = isExpanded ? "none" : "block";
    });

    postsContainer.appendChild(card);
  });
});
