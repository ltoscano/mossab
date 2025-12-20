/**
 * Format Helpers
 *
 * Utilities per formattare risultati in modo ricco e visuale nella chat.
 * Usa markdown, tabelle, grafici ASCII, syntax highlighting.
 */

class FormatHelpers {
    /**
     * Formatta git diff con syntax highlighting
     */
    static formatDiff(diff, maxLines = 50) {
        if (!diff || diff.trim() === '') {
            return '_No changes_';
        }

        const lines = diff.split('\n');
        const truncated = lines.length > maxLines;
        const displayLines = truncated ? lines.slice(0, maxLines) : lines;

        let formatted = '```diff\n';
        formatted += displayLines.join('\n');
        if (truncated) {
            formatted += `\n... (${lines.length - maxLines} more lines)`;
        }
        formatted += '\n```';

        return formatted;
    }

    /**
     * Formatta git status in formato leggibile
     */
    static formatGitStatus(status) {
        const { branch, staged, unstaged, untracked, conflicts, clean } = status;

        let output = `## 🌿 Git Status\n\n`;
        output += `**Branch:** \`${branch}\`\n\n`;

        if (clean) {
            output += '✨ **Working tree clean** - No changes to commit\n';
            return output;
        }

        // Conflicts (most urgent)
        if (conflicts.length > 0) {
            output += `### ⚠️ Conflicts (${conflicts.length})\n\n`;
            for (const file of conflicts.slice(0, 10)) {
                output += `- 🔴 \`${file}\`\n`;
            }
            if (conflicts.length > 10) {
                output += `- _... and ${conflicts.length - 10} more_\n`;
            }
            output += '\n';
        }

        // Staged changes
        if (staged.length > 0) {
            output += `### ✓ Staged Changes (${staged.length})\n\n`;
            for (const file of staged.slice(0, 10)) {
                output += `- ✅ \`${file}\`\n`;
            }
            if (staged.length > 10) {
                output += `- _... and ${staged.length - 10} more_\n`;
            }
            output += '\n';
        }

        // Unstaged changes
        if (unstaged.length > 0) {
            output += `### ○ Unstaged Changes (${unstaged.length})\n\n`;
            for (const file of unstaged.slice(0, 10)) {
                output += `- 📝 \`${file}\`\n`;
            }
            if (unstaged.length > 10) {
                output += `- _... and ${unstaged.length - 10} more_\n`;
            }
            output += '\n';
        }

        // Untracked files
        if (untracked.length > 0) {
            output += `### ? Untracked Files (${untracked.length})\n\n`;
            for (const file of untracked.slice(0, 10)) {
                output += `- ❓ \`${file}\`\n`;
            }
            if (untracked.length > 10) {
                output += `- _... and ${untracked.length - 10} more_\n`;
            }
            output += '\n';
        }

        return output;
    }

    /**
     * Formatta diff stats con grafici ASCII
     */
    static formatDiffStats(stats) {
        const { files, additions, deletions } = stats;

        let output = `### 📊 Changes Summary\n\n`;

        // Bar chart per additions/deletions
        const maxBar = 30;
        const total = additions + deletions;
        const addBar = total > 0 ? Math.round((additions / total) * maxBar) : 0;
        const delBar = total > 0 ? Math.round((deletions / total) * maxBar) : 0;

        output += `\`\`\`\n`;
        output += `Files:     ${files}\n`;
        output += `Added:     ${'█'.repeat(addBar)}${' '.repeat(maxBar - addBar)} +${additions}\n`;
        output += `Deleted:   ${'█'.repeat(delBar)}${' '.repeat(maxBar - delBar)} -${deletions}\n`;
        output += `Total:     ${total} lines changed\n`;
        output += `\`\`\`\n\n`;

        return output;
    }

    /**
     * Formatta file changes con dettagli
     */
    static formatFileChanges(files, maxFiles = 15) {
        if (!files || files.length === 0) {
            return '_No file changes_\n';
        }

        let output = `### 📁 Files Changed (${files.length})\n\n`;

        const displayFiles = files.slice(0, maxFiles);

        for (const file of displayFiles) {
            const { file: filename, additions, deletions } = file;

            // Visual bar
            const total = additions + deletions;
            const maxBarLength = 20;
            const addLength = total > 0 ? Math.round((additions / total) * maxBarLength) : 0;
            const delLength = total > 0 ? Math.round((deletions / total) * maxBarLength) : 0;

            const bar = `${'▓'.repeat(addLength)}${'░'.repeat(delLength)}`;

            output += `- \`${filename}\`\n`;
            output += `  ${bar} \`+${additions} -${deletions}\`\n\n`;
        }

        if (files.length > maxFiles) {
            output += `_... and ${files.length - maxFiles} more files_\n\n`;
        }

        return output;
    }

    /**
     * Formatta code review score con progress bar
     */
    static formatReviewScore(score) {
        const { total, grade, breakdown, deductions } = score;

        let output = `## 🎯 Code Quality Score\n\n`;

        // Progress bar
        const barLength = 40;
        const filled = Math.round((total / 100) * barLength);
        const empty = barLength - filled;

        // Color coding
        let emoji = '🟢';
        if (total < 60) emoji = '🔴';
        else if (total < 75) emoji = '🟡';
        else if (total < 85) emoji = '🟠';

        output += `### ${emoji} ${total}/100 (Grade: ${grade})\n\n`;
        output += `\`\`\`\n`;
        output += `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${total}%\n`;
        output += `\`\`\`\n\n`;

        if (deductions > 0) {
            output += `_Deductions: -${deductions} points_\n\n`;
        }

        // Breakdown by category
        if (breakdown && Object.keys(breakdown).length > 0) {
            output += `### 📊 Score Breakdown\n\n`;

            const categories = {
                security: { icon: '🔒', name: 'Security' },
                performance: { icon: '⚡', name: 'Performance' },
                quality: { icon: '✨', name: 'Quality' },
                maintainability: { icon: '🔧', name: 'Maintainability' },
                testing: { icon: '🧪', name: 'Testing' },
                documentation: { icon: '📝', name: 'Documentation' }
            };

            for (const [category, data] of Object.entries(breakdown)) {
                if (data.issues > 0) {
                    const cat = categories[category] || { icon: '•', name: category };
                    const impact = data.score < 0 ? `${data.score}` : `+${data.score}`;
                    output += `- ${cat.icon} **${cat.name}**: ${data.issues} issue(s) (${impact})\n`;
                }
            }
            output += '\n';
        }

        return output;
    }

    /**
     * Formatta lista di issues in tabella
     */
    static formatIssues(issues, maxIssues = 10) {
        if (!issues || issues.length === 0) {
            return '✅ **No issues found!**\n\n';
        }

        const severityIcons = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🔵',
            info: 'ℹ️'
        };

        const categoryIcons = {
            security: '🔒',
            performance: '⚡',
            quality: '✨',
            maintainability: '🔧',
            testing: '🧪',
            documentation: '📝'
        };

        // Group by severity
        const critical = issues.filter(i => i.severity === 'critical');
        const high = issues.filter(i => i.severity === 'high');
        const medium = issues.filter(i => i.severity === 'medium');
        const low = issues.filter(i => i.severity === 'low');

        let output = `## 🔍 Issues Found (${issues.length})\n\n`;

        // Summary counts
        output += `| Severity | Count |\n`;
        output += `|----------|-------|\n`;
        if (critical.length > 0) output += `| ${severityIcons.critical} Critical | ${critical.length} |\n`;
        if (high.length > 0) output += `| ${severityIcons.high} High | ${high.length} |\n`;
        if (medium.length > 0) output += `| ${severityIcons.medium} Medium | ${medium.length} |\n`;
        if (low.length > 0) output += `| ${severityIcons.low} Low | ${low.length} |\n`;
        output += '\n';

        // Detailed issues (prioritize by severity)
        const sortedIssues = [
            ...critical,
            ...high,
            ...medium,
            ...low
        ].slice(0, maxIssues);

        output += `### 📋 Issue Details\n\n`;

        for (let i = 0; i < sortedIssues.length; i++) {
            const issue = sortedIssues[i];
            const sevIcon = severityIcons[issue.severity] || '•';
            const catIcon = categoryIcons[issue.category] || '•';

            output += `#### ${i + 1}. ${sevIcon} ${issue.title}\n\n`;
            output += `**Category:** ${catIcon} ${issue.category}\n`;
            output += `**Severity:** ${issue.severity}\n`;
            output += `**Location:** \`${issue.file}:${issue.line}\`\n\n`;
            output += `${issue.description}\n\n`;

            if (issue.code) {
                output += `**Code:**\n\`\`\`\n${issue.code}\n\`\`\`\n\n`;
            }

            if (issue.suggestion) {
                output += `💡 **Fix:** ${issue.suggestion}\n\n`;
            }

            output += `---\n\n`;
        }

        if (issues.length > maxIssues) {
            output += `_... and ${issues.length - maxIssues} more issues_\n\n`;
        }

        return output;
    }

    /**
     * Formatta suggestions
     */
    static formatSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            return '';
        }

        let output = `## 💡 Suggestions for Improvement\n\n`;

        for (const suggestion of suggestions.slice(0, 5)) {
            output += `### ${suggestion.title}\n\n`;
            output += `${suggestion.description}\n\n`;
            if (suggestion.benefit) {
                output += `**Benefit:** ${suggestion.benefit}\n\n`;
            }
        }

        return output;
    }

    /**
     * Formatta commit log
     */
    static formatCommitLog(commits, maxCommits = 10) {
        if (!commits || commits.length === 0) {
            return '_No commits found_\n';
        }

        let output = `## 📜 Commit History\n\n`;

        const displayCommits = commits.slice(0, maxCommits);

        for (const commit of displayCommits) {
            // Commit può essere string o object
            if (typeof commit === 'string') {
                output += `- ${commit}\n`;
            } else {
                const hash = commit.hash || commit.sha || 'N/A';
                const shortHash = hash.substring(0, 7);
                const message = commit.message || commit.commit?.message || '';
                const author = commit.author || commit.commit?.author?.name || '';
                const date = commit.date || commit.commit?.author?.date || '';

                output += `### \`${shortHash}\` ${message.split('\n')[0]}\n\n`;
                if (author) output += `**Author:** ${author}\n`;
                if (date) output += `**Date:** ${new Date(date).toLocaleString()}\n`;
                output += '\n';
            }
        }

        if (commits.length > maxCommits) {
            output += `_... and ${commits.length - maxCommits} more commits_\n`;
        }

        return output;
    }

    /**
     * Formatta PR info
     */
    static formatPullRequest(pr) {
        const state = pr.state === 'open' ? '🟢 Open' : '🔴 Closed';
        const merged = pr.merged ? '✅ Merged' : '';

        let output = `## 🔀 Pull Request #${pr.number}\n\n`;
        output += `### ${pr.title}\n\n`;
        output += `**Status:** ${state} ${merged}\n`;
        output += `**Branch:** \`${pr.head}\` → \`${pr.base}\`\n`;
        output += `**Author:** ${pr.author}\n`;
        output += `**Created:** ${new Date(pr.created_at).toLocaleString()}\n\n`;

        if (pr.body) {
            output += `### Description\n\n${pr.body}\n\n`;
        }

        if (pr.stats) {
            output += `### Changes\n\n`;
            output += `- **Files:** ${pr.stats.files}\n`;
            output += `- **Additions:** +${pr.stats.additions}\n`;
            output += `- **Deletions:** -${pr.stats.deletions}\n\n`;
        }

        if (pr.url) {
            output += `**URL:** ${pr.url}\n\n`;
        }

        return output;
    }

    /**
     * Formatta lista di PRs
     */
    static formatPullRequestList(prs, maxPrs = 10) {
        if (!prs || prs.length === 0) {
            return '_No pull requests found_\n';
        }

        let output = `## 📋 Pull Requests (${prs.length})\n\n`;

        const displayPrs = prs.slice(0, maxPrs);

        for (const pr of displayPrs) {
            const state = pr.state === 'open' ? '🟢' : '🔴';
            const merged = pr.merged ? '✅' : '';

            output += `### ${state} #${pr.number}: ${pr.title} ${merged}\n\n`;
            output += `\`${pr.head}\` → \`${pr.base}\`\n`;
            output += `Author: ${pr.author} • ${new Date(pr.created_at).toLocaleDateString()}\n\n`;

            if (pr.url) {
                output += `[View PR](${pr.url})\n\n`;
            }

            output += `---\n\n`;
        }

        if (prs.length > maxPrs) {
            output += `_... and ${prs.length - maxPrs} more PRs_\n`;
        }

        return output;
    }

    /**
     * Formatta security scan results
     */
    static formatSecurityScan(scanResults) {
        const { issues, critical, high, summary } = scanResults;

        let output = `## 🔒 Security Scan Results\n\n`;

        if (issues.length === 0) {
            output += `✅ **No security issues found!**\n\n`;
            output += `Your code passed the security scan. Great job! 🎉\n`;
            return output;
        }

        // Alert level
        if (critical > 0) {
            output += `⚠️ **CRITICAL ALERT:** ${critical} critical security issue(s) found!\n\n`;
        } else if (high > 0) {
            output += `⚠️ **WARNING:** ${high} high-priority security issue(s) found!\n\n`;
        }

        // Summary stats
        output += `| Severity | Count |\n`;
        output += `|----------|-------|\n`;
        if (critical > 0) output += `| 🔴 Critical | ${critical} |\n`;
        if (high > 0) output += `| 🟠 High | ${high} |\n`;
        output += `\n`;

        // Issue details
        output += this.formatIssues(issues, 5);

        if (summary) {
            output += `\n${summary}\n`;
        }

        return output;
    }

    /**
     * Crea box ASCII per messaggi importanti
     */
    static createBox(title, content, width = 60) {
        const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
        const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';

        let output = '```\n';
        output += topBorder + '\n';

        // Title
        if (title) {
            const titlePadded = this.padCenter(title, width - 4);
            output += '│ ' + titlePadded + ' │\n';
            output += '├' + '─'.repeat(width - 2) + '┤\n';
        }

        // Content
        const lines = content.split('\n');
        for (const line of lines) {
            const padded = this.padRight(line, width - 4);
            output += '│ ' + padded + ' │\n';
        }

        output += bottomBorder + '\n';
        output += '```\n';

        return output;
    }

    /**
     * Helper: pad string to center
     */
    static padCenter(str, width) {
        if (str.length >= width) return str.substring(0, width);
        const leftPad = Math.floor((width - str.length) / 2);
        const rightPad = width - str.length - leftPad;
        return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    }

    /**
     * Helper: pad string to right
     */
    static padRight(str, width) {
        if (str.length >= width) return str.substring(0, width);
        return str + ' '.repeat(width - str.length);
    }

    /**
     * Formatta output completo di code review
     */
    static formatCodeReview(reviewResult) {
        const { success, score, summary, issues, suggestions, stats } = reviewResult;

        if (!success) {
            return `❌ Code review failed: ${reviewResult.message || 'Unknown error'}`;
        }

        let output = `# 🔍 Code Review Complete\n\n`;

        // Score
        if (score) {
            output += this.formatReviewScore(score);
        }

        // Stats
        if (stats) {
            output += this.formatDiffStats(stats);
        }

        // Issues
        if (issues && issues.length > 0) {
            output += this.formatIssues(issues);
        } else {
            output += `✅ **No issues found!** Your code looks great! 🎉\n\n`;
        }

        // Suggestions
        if (suggestions && suggestions.length > 0) {
            output += this.formatSuggestions(suggestions);
        }

        // Summary (if provided as string)
        if (summary && typeof summary === 'string') {
            output += `## 📝 Summary\n\n${summary}\n\n`;
        }

        return output;
    }
}

module.exports = FormatHelpers;
