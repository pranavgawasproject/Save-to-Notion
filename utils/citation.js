// ============================================
// CITATION GENERATOR
// ============================================

export const CitationGenerator = {
  
  /**
   * Generate citation in specified format
   */
  generate(pageInfo, format = 'apa') {
    const data = this.normalizeData(pageInfo);
    
    let formatted;
    switch (format.toLowerCase()) {
      case 'apa':
        formatted = this.formatAPA(data);
        break;
      case 'mla':
        formatted = this.formatMLA(data);
        break;
      case 'chicago':
        formatted = this.formatChicago(data);
        break;
      case 'harvard':
        formatted = this.formatHarvard(data);
        break;
      default:
        formatted = this.formatAPA(data);
    }
    
    return {
      format: format,
      formatted: formatted,
      data: data
    };
  },
  
  /**
   * Normalize page info data
   */
  normalizeData(pageInfo) {
    const now = new Date();
    
    // Parse published date
    let publishedDate = null;
    if (pageInfo.publishedDate) {
      publishedDate = new Date(pageInfo.publishedDate);
      if (isNaN(publishedDate.getTime())) {
        publishedDate = null;
      }
    }
    
    // Extract domain as site name fallback
    let siteName = pageInfo.siteName;
    if (!siteName && pageInfo.url) {
      try {
        const url = new URL(pageInfo.url);
        siteName = url.hostname.replace('www.', '');
      } catch {
        siteName = 'Unknown';
      }
    }
    
    return {
      author: pageInfo.author || null,
      title: pageInfo.title || 'Untitled',
      siteName: siteName,
      url: pageInfo.url,
      publishedDate: publishedDate,
      accessDate: now,
      description: pageInfo.description
    };
  },
  
  /**
   * Format date for citations
   */
  formatDate(date, style = 'full') {
    if (!date) return 'n.d.';
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthsShort = [
      'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June',
      'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'
    ];
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    switch (style) {
      case 'year':
        return year.toString();
      case 'monthYear':
        return `${months[month]} ${year}`;
      case 'full':
        return `${months[month]} ${day}, ${year}`;
      case 'mla':
        return `${day} ${monthsShort[month]} ${year}`;
      case 'iso':
        return date.toISOString().split('T')[0];
      default:
        return `${months[month]} ${day}, ${year}`;
    }
  },
  
  /**
   * APA 7th Edition Format
   * Author, A. A. (Year, Month Day). Title of page. Site Name. URL
   */
  formatAPA(data) {
    const parts = [];
    
    // Author
    if (data.author) {
      parts.push(this.formatAuthorAPA(data.author));
    }
    
    // Date
    if (data.publishedDate) {
      parts.push(`(${this.formatDate(data.publishedDate, 'full')})`);
    } else {
      parts.push('(n.d.)');
    }
    
    // Title (in italics for web pages)
    parts.push(`${data.title}.`);
    
    // Site Name
    if (data.siteName && data.siteName !== data.author) {
      parts.push(`${data.siteName}.`);
    }
    
    // URL
    parts.push(data.url);
    
    return parts.join(' ');
  },
  
  /**
   * Format author name for APA
   */
  formatAuthorAPA(author) {
    if (!author) return '';
    
    // Check if it's already formatted (Last, F.)
    if (author.includes(',')) {
      return author + '.';
    }
    
    // Try to split first and last name
    const parts = author.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return parts[0] + '.';
    }
    
    if (parts.length === 2) {
      const [first, last] = parts;
      return `${last}, ${first.charAt(0).toUpperCase()}.`;
    }
    
    // Multiple names: Last, F. M.
    const last = parts.pop();
    const initials = parts.map(p => p.charAt(0).toUpperCase() + '.').join(' ');
    return `${last}, ${initials}`;
  },
  
  /**
   * MLA 9th Edition Format
   * Author. "Title of Page." Site Name, Day Month Year, URL. Accessed Day Month Year.
   */
  formatMLA(data) {
    const parts = [];
    
    // Author
    if (data.author) {
      parts.push(this.formatAuthorMLA(data.author) + '.');
    }
    
    // Title (in quotes)
    parts.push(`"${data.title}."`);
    
    // Site Name (in italics - we'll just use text)
    if (data.siteName) {
      parts.push(`${data.siteName},`);
    }
    
    // Published date
    if (data.publishedDate) {
      parts.push(`${this.formatDate(data.publishedDate, 'mla')},`);
    }
    
    // URL
    parts.push(`${data.url}.`);
    
    // Access date
    parts.push(`Accessed ${this.formatDate(data.accessDate, 'mla')}.`);
    
    return parts.join(' ');
  },
  
  /**
   * Format author name for MLA
   */
  formatAuthorMLA(author) {
    if (!author) return '';
    
    // Check if already formatted
    if (author.includes(',')) {
      return author;
    }
    
    const parts = author.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return parts[0];
    }
    
    // Last, First Middle
    const last = parts.pop();
    return `${last}, ${parts.join(' ')}`;
  },
  
  /**
   * Chicago 17th Edition Format
   * Author. "Title of Page." Site Name. Published/Modified date. URL.
   */
  formatChicago(data) {
    const parts = [];
    
    // Author
    if (data.author) {
      parts.push(this.formatAuthorChicago(data.author) + '.');
    }
    
    // Title
    parts.push(`"${data.title}."`);
    
    // Site Name
    if (data.siteName) {
      parts.push(`${data.siteName}.`);
    }
    
    // Date
    if (data.publishedDate) {
      parts.push(`${this.formatDate(data.publishedDate, 'full')}.`);
    }
    
    // URL
    parts.push(data.url);
    
    return parts.join(' ');
  },
  
  /**
   * Format author name for Chicago
   */
  formatAuthorChicago(author) {
    if (!author) return '';
    
    // Chicago uses same format as MLA for first author
    return this.formatAuthorMLA(author);
  },
  
  /**
   * Harvard Format
   * Author (Year) Title. Available at: URL (Accessed: Day Month Year).
   */
  formatHarvard(data) {
    const parts = [];
    
    // Author
    if (data.author) {
      parts.push(this.formatAuthorHarvard(data.author));
    } else {
      parts.push(data.siteName || 'Unknown');
    }
    
    // Year
    if (data.publishedDate) {
      parts.push(`(${this.formatDate(data.publishedDate, 'year')})`);
    } else {
      parts.push('(n.d.)');
    }
    
    // Title (in italics)
    parts.push(`${data.title}.`);
    
    // Available at
    parts.push(`Available at: ${data.url}`);
    
    // Accessed
    parts.push(`(Accessed: ${this.formatDate(data.accessDate, 'full')}).`);
    
    return parts.join(' ');
  },
  
  /**
   * Format author name for Harvard
   */
  formatAuthorHarvard(author) {
    if (!author) return '';
    
    const parts = author.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return parts[0];
    }
    
    // Last, F.
    const last = parts.pop();
    const initials = parts.map(p => p.charAt(0).toUpperCase() + '.').join('');
    return `${last}, ${initials}`;
  },
  
  /**
   * Generate BibTeX format
   */
  formatBibTeX(data) {
    const key = this.generateBibTeXKey(data);
    const year = data.publishedDate 
      ? data.publishedDate.getFullYear() 
      : new Date().getFullYear();
    
    return `@online{${key},
  author = {${data.author || 'Unknown'}},
  title = {${data.title}},
  year = {${year}},
  url = {${data.url}},
  urldate = {${this.formatDate(data.accessDate, 'iso')}},
  note = {${data.siteName || ''}}
}`;
  },
  
  /**
   * Generate BibTeX key
   */
  generateBibTeXKey(data) {
    const author = data.author 
      ? data.author.split(/\s+/).pop().toLowerCase()
      : 'unknown';
    const year = data.publishedDate 
      ? data.publishedDate.getFullYear()
      : new Date().getFullYear();
    const titleWord = data.title
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    
    return `${author}${year}${titleWord}`;
  },
  
  /**
   * Get all formats for a page
   */
  getAllFormats(pageInfo) {
    const data = this.normalizeData(pageInfo);
    
    return {
      apa: this.formatAPA(data),
      mla: this.formatMLA(data),
      chicago: this.formatChicago(data),
      harvard: this.formatHarvard(data),
      bibtex: this.formatBibTeX(data),
      data: data
    };
  }
};

// For non-module usage
if (typeof window !== 'undefined') {
  window.CitationGenerator = CitationGenerator;
}
