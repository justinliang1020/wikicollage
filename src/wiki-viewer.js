/**
 * WikiViewer Web Component
 * Self-contained Wikipedia viewer with isolated styles and link handling
 */
class WikiViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.currentPage = "Cat";
    this.content = "";
    this.loading = false;
    this.render();
    this.setupEventListeners();
  }

  static get observedAttributes() {
    return ["page", "content", "loading"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case "page":
        this.currentPage = newValue || "Cat";
        if (oldValue && oldValue !== newValue) {
          this.fetchWikiPage(this.currentPage);
        }
        break;
      case "content":
        this.content = newValue || "";
        break;
      case "loading":
        this.loading = newValue === "true";
        break;
    }
    this.render();
  }

  connectedCallback() {
    // Fetch initial content if page is set
    if (this.currentPage && !this.content) {
      this.fetchWikiPage(this.currentPage);
    }
  }

  async fetchWikiPage(page) {
    this.loading = true;
    this.render();

    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(page)}`,
      );
      const html = await response.text();
      this.content = this.processWikipediaContent(html);
      this.loading = false;
    } catch (error) {
      console.error("Failed to load Wikipedia page:", error);
      this.content = "<p>Failed to load page.</p>";
      this.loading = false;
    }

    this.render();
    this.dispatchEvent(
      new CustomEvent("page-loaded", {
        detail: { page: this.currentPage, content: this.content },
      }),
    );
  }

  /**
   * Process Wikipedia HTML content to fix relative URLs
   * @param {string} html - Raw Wikipedia HTML
   * @returns {string} Processed HTML with absolute URLs
   */
  processWikipediaContent(html) {
    // Create a temporary DOM to process the content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Fix image sources
    const images = tempDiv.querySelectorAll("img");
    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("//")) {
        // Protocol-relative URLs
        img.setAttribute("src", "https:" + src);
        img.setAttribute("srcset", "https:" + src);
      } else if (src && src.startsWith("/")) {
        // Relative URLs - these need to be converted to Wikipedia URLs
        img.setAttribute("src", "https://en.wikipedia.org" + src);
        img.setAttribute("srcset", "https://en.wikipedia.org" + src);
      }
    });

    // Fix link hrefs to be absolute for external links
    const links = tempDiv.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("/wiki/")) {
        // Non-wiki relative URLs
        link.setAttribute("href", "https://en.wikipedia.org" + href);
      }
    });

    return tempDiv.innerHTML;
  }

  setupEventListeners() {
    this.shadowRoot.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");

      // Match only internal wiki links like /wiki/Dog
      if (href && href.startsWith("/wiki/")) {
        event.preventDefault();
        const newPage = decodeURIComponent(href.replace("/wiki/", ""));
        this.setAttribute("page", newPage);

        // Dispatch custom event for external listeners
        this.dispatchEvent(
          new CustomEvent("page-changed", {
            detail: { page: newPage },
          }),
        );
      }
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          font-family: sans-serif;
        }
        
        .container {
          max-width: 700px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        
        .header {
          margin-bottom: 20px;
        }
        
        .title {
          margin: 0 0 10px 0;
          font-size: 24px;
          font-weight: bold;
        }
        
        .current-page {
          margin: 0;
          color: #666;
        }
        
        .current-page b {
          color: #000;
        }
        
        .loading {
          color: #666;
          font-style: italic;
        }
        
        .content {
          line-height: 1.6;
        }
        
        /* Wikipedia content styles */
        .content a {
          color: #0645ad;
          text-decoration: none;
        }
        
        .content a:hover {
          text-decoration: underline;
        }
        
        .content a:visited {
          color: #0b0080;
        }
        
        .content img {
          max-width: 100%;
          height: auto;
        }
        
        .content table {
          border-collapse: collapse;
          margin: 1em 0;
        }
        
        .content th,
        .content td {
          border: 1px solid #a2a9b1;
          padding: 0.2em 0.4em;
        }
        
        .content th {
          background-color: #eaecf0;
        }
        
        .content blockquote {
          border-left: 4px solid #eaecf0;
          margin: 1em 0;
          padding-left: 1em;
          color: #666;
        }
        
        .content pre {
          background-color: #f8f9fa;
          border: 1px solid #eaecf0;
          padding: 1em;
          overflow-x: auto;
        }
        
        .content .infobox {
          float: right;
          clear: right;
          width: 22em;
          margin: 0 0 1em 1em;
          border: 1px solid #a2a9b1;
          background-color: #f8f9fa;
          padding: 0.2em;
        }
        
        .content .navbox {
          border: 1px solid #a2a9b1;
          clear: both;
          font-size: 88%;
          margin: auto;
          padding: 1px;
          width: 100%;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .current-page {
            color: #ccc;
          }
          
          .current-page b {
            color: #fff;
          }
          
          .content {
            color: #fff;
          }
          
          .content a {
            color: #6ab7ff;
          }
          
          .content a:visited {
            color: #d19fe8;
          }
          
          .content th {
            background-color: #2a2a2a;
          }
          
          .content th,
          .content td {
            border-color: #555;
          }
          
          .content pre {
            background-color: #2a2a2a;
            border-color: #555;
          }
          
          .content .infobox {
            background-color: #2a2a2a;
            border-color: #555;
          }
          
          .content .navbox {
            border-color: #555;
          }
        }
      </style>
      
      <div class="container">
        <div class="header">
          <h1 class="title">Wikipedia Viewer</h1>
          <p class="current-page">Currently viewing: <b>${this.currentPage}</b></p>
          ${this.loading ? '<p class="loading">Loading...</p>' : ""}
        </div>
        <div class="content">${this.content}</div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define("wiki-viewer", WikiViewer);

