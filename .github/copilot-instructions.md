# Bills Q Tracker - AI Coding Assistant Instructions

## Project Overview
This is a static web application for family budget tracking, built with vanilla HTML, CSS, and JavaScript. The app runs entirely in the browser with data stored in localStorage, making it simple to deploy and use without a backend.

## Architecture & Components

### Core Structure
- **HTML (`index.html`)**: Single-page application with tabbed interface (Dashboard, Monthly Budget, Expenses)
- **CSS (`styles.css`)**: Modern responsive design with CSS custom properties and gradients
- **JavaScript (`script.js`)**: All business logic, data management, and UI interactions

### Key Components
1. **Dashboard**: Overview with financial health status, budget categories visualization, and monthly performance grid
2. **Monthly Budget**: Tabbed interface for each month with bill tracking, actual vs. budgeted amounts, and over/under calculations
3. **Expenses**: Transaction log with manual entry, CSV import, and inline editing
4. **Family Expense Tracking**: Separate tracking for shared family expenses with payer/reimbursement logic

### Data Flow
- **Storage**: All data persists in browser localStorage (`transactions`, `monthlyBudgets`, `familyExpenses`, `currentTab`, `currentMonth`)
- **State Management**: Direct DOM manipulation with JavaScript functions updating multiple views simultaneously
- **Calculations**: Real-time budget vs. actual comparisons, monthly aggregations, and financial health indicators

## Critical Developer Workflows

### Local Development
- Edit HTML/CSS/JS files directly in any text editor
- Open `index.html` in a modern browser to test
- No build process required - pure static files

### Deployment
- Hosted on GitHub Pages (free static hosting)
- Use provided batch files for Windows deployment:
  - `git-setup.bat`: Initialize git repository and push to GitHub
  - `deploy.bat`: Deploy updates to GitHub Pages
  - `push-updates.bat`: Push code changes

### Data Management
- **Transactions**: Stored as array of objects with date, source, amount, bill category
- **Budgets**: Monthly-specific budgets stored per bill category
- **CSV Import**: Supports major banks (Chase, Wells Fargo, Bank of America, Capital One) with auto-categorization

## Project-Specific Patterns & Conventions

### Bill Categories & Logic
- **Hardcoded Categories**: Bills are predefined in HTML select options and JavaScript arrays
- **Positive Credit Bills**: Categories like Gas, Groceries where spending under budget shows positive over/under
- **Extra Paid Categories**: "Extra Paid Erik", "Erik Paid Sara" are always positive contributions
- **Auto-Categorization**: Keyword-based mapping from transaction descriptions to bill categories

### UI/UX Patterns
- **Tabbed Navigation**: Single-page app with show/hide tab content
- **Modal Forms**: All data entry uses modal dialogs
- **Inline Editing**: Click-to-edit in transaction tables
- **Voice Input**: Speech recognition for accessibility (source, amount, bill category)
- **Responsive Design**: Mobile-first with CSS Grid and Flexbox

### Code Organization
- **Global State**: Arrays and objects at top of script.js (`transactions`, `monthlyBudgets`, `familyExpenses`)
- **Utility Functions**: Data persistence (`saveTransactions()`, `loadTransactions()`)
- **UI Functions**: Tab switching, modal management, table updates
- **Business Logic**: Budget calculations, CSV parsing, voice recognition

### Naming Conventions
- **Functions**: camelCase, descriptive names (`updateBudgetFromTransactions()`, `autoCategorizeBill()`)
- **Variables**: camelCase, arrays for collections (`transactions`, `familyExpenses`)
- **CSS Classes**: kebab-case, semantic names (`.stat-card`, `.budget-table`)
- **IDs**: camelCase for JavaScript interaction (`transactionDate`, `csvPreview`)

## Integration Points

### CSV Import System
- **Bank Detection**: Automatic format detection based on CSV headers
- **Data Parsing**: Handles different date formats, amount columns, debit/credit splits
- **Duplicate Prevention**: Checks existing transactions before import
- **Auto-Categorization**: Maps merchant names to bill categories using keyword matching

### Voice Recognition
- **Web Speech API**: Browser-native speech recognition
- **Field-Specific**: Separate processing for source, amount, bill category
- **Fallback**: Manual input if voice fails

### External Dependencies
- **None**: Pure vanilla JavaScript, no npm packages or frameworks
- **Browser APIs**: localStorage, Web Speech API, File API for CSV upload

## Common Tasks & Patterns

### Adding New Bill Categories
1. Update HTML select options in `index.html`
2. Add to JavaScript arrays (`billCategories`, `positiveCreditBills`)
3. Update default budgets in `loadMonthBudget()`
4. Add keyword mappings in `autoCategorizeBill()`

### Modifying Calculations
- **Over/Under Logic**: Check `updateBudgetFromTransactions()` for bill-specific rules
- **Dashboard Stats**: Update in `updateDashboard()` function
- **Monthly Aggregation**: Modify grouping logic in `updateTransactionTable()`

### Styling Changes
- **CSS Variables**: Use root variables for colors, spacing, shadows
- **Responsive**: Test breakpoints at 1400px, 1200px, 768px, 480px
- **Animations**: CSS transitions with cubic-bezier easing

### Data Persistence
- **Load on Init**: All data loaded in `DOMContentLoaded` event
- **Save on Change**: Call save functions after any data modification
- **Migration**: No schema - data is plain JSON objects

## Key Files to Reference

- [`script.js`](script.js#L1-L100): Core data structures and initialization
- [`script.js`](script.js#L500-L600): CSV import and bank detection logic
- [`script.js`](script.js#L1000-L1100): Budget calculation algorithms
- [`styles.css`](styles.css#L1-L50): Design system and CSS variables
- [`index.html`](index.html#L200-L300): Budget table structure and categories
- [`deploy.bat`](deploy.bat): Deployment workflow example

## Development Best Practices

- **Test in Multiple Browsers**: Ensure localStorage and Web Speech API compatibility
- **Mobile Testing**: Responsive design critical for family use
- **Data Validation**: Always validate amounts > 0, valid dates
- **Error Handling**: Use `showNotification()` for user feedback
- **Performance**: Minimal DOM manipulation, efficient array operations

## Deployment Checklist

- [ ] Test all features in target browser
- [ ] Clear localStorage if data structure changes
- [ ] Update README.md for new features
- [ ] Commit and push changes
- [ ] Verify GitHub Pages deployment</content>
<parameter name="filePath">c:\Users\johns\bills-website\.github\copilot-instructions.md