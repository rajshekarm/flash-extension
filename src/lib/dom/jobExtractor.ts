// Job Extractor - Extracts job information from job posting pages
import type { ExtractedJobInfo, JobBoardPattern } from '~types';

export class JobExtractor {
  private patterns: JobBoardPattern[] = [
    {
      domain: 'linkedin.com',
      name: 'LinkedIn',
      selectors: {
        title: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', 'h1'],
        company: ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link'],
        location: ['.job-details-jobs-unified-top-card__bullet', '.jobs-unified-top-card__bullet'],
        description: ['.jobs-description__content', '.jobs-description', '.description__text'],
      },
    },
    {
      domain: 'greenhouse.io',
      name: 'Greenhouse',
      selectors: {
        title: ['.app-title', '#header h1', 'h1'],
        company: ['.company-name', '[class*="company"]'],
        location: ['.location', '[class*="location"]'],
        description: ['#content', '.content', '[class*="description"]'],
      },
    },
    {
      domain: 'lever.co',
      name: 'Lever',
      selectors: {
        title: ['.posting-headline h2', 'h2'],
        company: ['.main-header-text', '[class*="company"]'],
        location: ['.sort-by-time', '.posting-categories .location'],
        description: ['.section-wrapper', '.content'],
      },
    },
    {
      domain: 'indeed.com',
      name: 'Indeed',
      selectors: {
        title: ['.jobsearch-JobInfoHeader-title', 'h1'],
        company: ['.jobsearch-InlineCompanyRating', '[data-company-name]'],
        location: ['.jobsearch-JobInfoHeader-subtitle', '[class*="location"]'],
        description: ['#jobDescriptionText', '.jobsearch-jobDescriptionText'],
      },
    },
    {
      domain: 'workday.com',
      name: 'Workday',
      selectors: {
        title: ['[data-automation-id="jobPostingHeader"]', 'h2[class*="title"]', 'h1'],
        company: ['[data-automation-id="company"]', '.company-name'],
        location: ['[data-automation-id="locations"]', '[class*="location"]'],
        description: ['[data-automation-id="jobPostingDescription"]', '[class*="description"]'],
      },
    },
    {
      domain: 'myworkdayjobs.com',
      name: 'Workday',
      selectors: {
        title: ['[data-automation-id="jobPostingHeader"]', 'h2[class*="title"]', 'h1'],
        company: ['[data-automation-id="company"]', '.company-name'],
        location: ['[data-automation-id="locations"]', '[class*="location"]'],
        description: ['[data-automation-id="jobPostingDescription"]', '[class*="description"]'],
      },
    },
  ];

  /**
   * Extract job information from current page
   */
  extractJobInfo(): ExtractedJobInfo {
    const domain = window.location.hostname;
    const pattern = this.patterns.find((p) => domain.includes(p.domain));

    const jobInfo: ExtractedJobInfo = {
      url: window.location.href,
      title: this.extractTitle(pattern),
      company: this.extractCompany(pattern),
      location: this.extractLocation(pattern),
      description: this.extractDescription(pattern),
      requirements: this.extractRequirements(),
      salary: this.extractSalary(),
      jobType: this.extractJobType(),
      postedDate: this.extractPostedDate(),
    };

    return jobInfo;
  }

  /**
   * Extract job title
   */
  private extractTitle(pattern?: JobBoardPattern): string | undefined {
    // Try pattern selectors first
    if (pattern?.selectors.title) {
      for (const selector of pattern.selectors.title) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          return element.textContent.trim();
        }
      }
    }

    // Fallback to common selectors
    const commonSelectors = [
      'h1[class*="title"]',
      'h1[class*="job"]',
      '[data-job-title]',
      '[class*="job-title"]',
      'meta[property="og:title"]',
    ];

    for (const selector of commonSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          return element.getAttribute('content') || undefined;
        }
        if (element.textContent) {
          return element.textContent.trim();
        }
      }
    }

    // Try page title as last resort
    const title = document.title;
    if (title && !title.toLowerCase().includes('sign in') && !title.toLowerCase().includes('login')) {
      return title.split('|')[0].split('-')[0].trim();
    }

    return undefined;
  }

  /**
   * Extract company name
   */
  private extractCompany(pattern?: JobBoardPattern): string | undefined {
    // Try pattern selectors first
    if (pattern?.selectors.company) {
      for (const selector of pattern.selectors.company) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          return element.textContent.trim();
        }
      }
    }

    // Fallback to common selectors
    const commonSelectors = [
      '[class*="company"]',
      '[data-company]',
      'meta[property="og:site_name"]',
    ];

    for (const selector of commonSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          return element.getAttribute('content') || undefined;
        }
        if (element.textContent) {
          return element.textContent.trim();
        }
      }
    }

    return undefined;
  }

  /**
   * Extract location
   */
  private extractLocation(pattern?: JobBoardPattern): string | undefined {
    // Try pattern selectors first
    if (pattern?.selectors.location) {
      for (const selector of pattern.selectors.location) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          return element.textContent.trim();
        }
      }
    }

    // Fallback to common selectors
    const commonSelectors = [
      '[class*="location"]',
      '[data-location]',
      '[class*="address"]',
    ];

    for (const selector of commonSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  /**
   * Extract job description
   */
  private extractDescription(pattern?: JobBoardPattern): string | undefined {
    // Try pattern selectors first
    if (pattern?.selectors.description) {
      for (const selector of pattern.selectors.description) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          return element.textContent.trim();
        }
      }
    }

    // Fallback to common selectors
    const commonSelectors = [
      '[class*="description"]',
      '[class*="job-details"]',
      '[class*="content"]',
      'meta[property="og:description"]',
    ];

    for (const selector of commonSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          return element.getAttribute('content') || undefined;
        }
        if (element.textContent && element.textContent.length > 100) {
          return element.textContent.trim();
        }
      }
    }

    return undefined;
  }

  /**
   * Extract requirements from job description
   */
  private extractRequirements(): string[] | undefined {
    const requirements: string[] = [];
    const description = document.body.textContent || '';

    // Look for requirements section
    const reqPatterns = [
      /requirements?:?\s*\n([\s\S]*?)(?:\n\n|qualifications?:|responsibilities?:|$)/i,
      /qualifications?:?\s*\n([\s\S]*?)(?:\n\n|requirements?:|responsibilities?:|$)/i,
      /must have:?\s*\n([\s\S]*?)(?:\n\n|nice to have:|requirements?:|$)/i,
    ];

    for (const pattern of reqPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const lines = match[1].split('\n');
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && (trimmed.startsWith('-') || trimmed.startsWith('•') || /^\d+\./.test(trimmed))) {
            requirements.push(trimmed.replace(/^[-•\d.]\s*/, '').trim());
          }
        });
      }
    }

    return requirements.length > 0 ? requirements : undefined;
  }

  /**
   * Extract salary information
   */
  private extractSalary(): string | undefined {
    const text = document.body.textContent || '';
    
    // Look for salary patterns
    const salaryPatterns = [
      /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*\/\s*(?:year|yr|hour|hr))?/i,
      /[\d,]+k?\s*-\s*[\d,]+k?(?:\s*\/\s*(?:year|yr|hour|hr))?/i,
    ];

    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    // Try common selectors
    const salarySelectors = [
      '[class*="salary"]',
      '[data-salary]',
      '[class*="compensation"]',
    ];

    for (const selector of salarySelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  /**
   * Extract job type (Full-time, Part-time, Contract, etc.)
   */
  private extractJobType(): string | undefined {
    const text = document.body.textContent?.toLowerCase() || '';
    
    const jobTypes = ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'remote', 'hybrid'];
    
    for (const type of jobTypes) {
      if (text.includes(type)) {
        return type.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('-');
      }
    }

    return undefined;
  }

  /**
   * Extract posted date
   */
  private extractPostedDate(): string | undefined {
    // Try common selectors
    const dateSelectors = [
      '[class*="posted"]',
      '[class*="date"]',
      '[datetime]',
      'time',
    ];

    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const datetime = element.getAttribute('datetime');
        if (datetime) return datetime;
        
        if (element.textContent) {
          return element.textContent.trim();
        }
      }
    }

    return undefined;
  }

  /**
   * Check if current page is a job posting
   */
  isJobPage(): boolean {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();

    // Check URL patterns
    const urlPatterns = [
      '/jobs/',
      '/job/',
      '/careers/',
      '/career/',
      '/positions/',
      '/apply/',
      'greenhouse.io',
      'lever.co',
      'workday.com',
    ];

    if (urlPatterns.some((pattern) => url.includes(pattern))) {
      return true;
    }

    // Check for job-related content
    const hasJobTitle = !!this.extractTitle();
    const hasCompany = !!this.extractCompany();
    const hasDescription = !!this.extractDescription();

    return hasJobTitle && (hasCompany || hasDescription);
  }
}

// Export singleton instance
export const jobExtractor = new JobExtractor();
