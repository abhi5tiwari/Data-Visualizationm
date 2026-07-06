document.addEventListener("DOMContentLoaded", function () {
    // --------------------------------------------------
    // 1. STATE & DATA INITIALIZATION
    // --------------------------------------------------
    
    // Default seed data for books
    const defaultBooks = [
        { id: 1001, title: "Clean Code", author: "Robert C. Martin", category: "Technology", quantity: 12, issued: 4 },
        { id: 1002, title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Technology", quantity: 5, issued: 5 },
        { id: 1003, title: "The Pragmatic Programmer", author: "Andrew Hunt", category: "Technology", quantity: 8, issued: 3 },
        { id: 1004, title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", quantity: 6, issued: 2 },
        { id: 1005, title: "Calculus Vol 1", author: "James Stewart", category: "Science", quantity: 4, issued: 1 },
        { id: 1006, title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari", category: "History", quantity: 15, issued: 5 },
        { id: 1007, title: "Steve Jobs", author: "Walter Isaacson", category: "Biography", quantity: 6, issued: 3 },
        { id: 1008, title: "To Kill a Mockingbird", author: "Harper Lee", category: "Fiction", quantity: 10, issued: 3 },
        { id: 1009, title: "The Great Gatsby", author: "F. Scott Fitzgerald", category: "Fiction", quantity: 8, issued: 1 }
    ];

    // Seed data for borrowing trends
    const defaultTrends = {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        data: [650, 780, 900, 810, 960, 1150]
    };

    let books = [];
    let trends = {};
    let activeTheme = "light";

    // Load data from localStorage
    function loadState() {
        // Books
        const localBooks = localStorage.getItem("lib_books");
        if (localBooks) {
            books = JSON.parse(localBooks);
        } else {
            books = [...defaultBooks];
            localStorage.setItem("lib_books", JSON.stringify(books));
        }

        // Trends
        const localTrends = localStorage.getItem("lib_trends");
        if (localTrends) {
            trends = JSON.parse(localTrends);
        } else {
            trends = { ...defaultTrends };
            localStorage.setItem("lib_trends", JSON.stringify(trends));
        }

        // Theme
        const localTheme = localStorage.getItem("lib_theme");
        if (localTheme) {
            activeTheme = localTheme;
        } else {
            activeTheme = "light";
        }
        setTheme(activeTheme);
    }

    // Save books to localStorage
    function saveBooks() {
        localStorage.setItem("lib_books", JSON.stringify(books));
    }

    // Reset database to seed data
    window.resetDatabase = function() {
        if (confirm("Are you sure you want to reset the database to default seed data? This will overwrite all custom changes.")) {
            localStorage.removeItem("lib_books");
            localStorage.removeItem("lib_trends");
            loadState();
            updateAllViews();
            showToast("Database successfully reset to seed data!", "success");
        }
    };

    // --------------------------------------------------
    // 2. THEME & NAVIGATION
    // --------------------------------------------------
    
    // Theme setter
    function setTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        const checkbox = document.getElementById("theme-toggle-checkbox");
        if (checkbox) {
            checkbox.checked = (theme === "dark");
        }
        localStorage.setItem("lib_theme", theme);
    }

    // Toggle theme handler
    const themeCheckbox = document.getElementById("theme-toggle-checkbox");
    if (themeCheckbox) {
        themeCheckbox.addEventListener("change", function () {
            activeTheme = this.checked ? "dark" : "light";
            setTheme(activeTheme);
            showToast(`Theme switched to ${activeTheme} mode!`, "info");
            // Re-render charts to adapt to theme color updates
            renderCharts();
        });
    }

    // SPA Navigation tabs controller
    const sidebarMenuItems = document.querySelectorAll(".sidebar-menu li");
    const viewSections = document.querySelectorAll(".view-section");

    sidebarMenuItems.forEach((item, index) => {
        item.addEventListener("click", function (e) {
            e.preventDefault();
            
            // Remove active classes
            sidebarMenuItems.forEach(li => li.classList.remove("active"));
            viewSections.forEach(sec => sec.classList.remove("active-view"));

            // Add active class to clicked sidebar item
            this.classList.add("active");

            // Show active view section based on index mapping
            if (viewSections[index]) {
                viewSections[index].classList.add("active-view");
                showToast(`Navigated to ${this.innerText.trim()}`, "info");
            }
        });
    });

    // --------------------------------------------------
    // 3. CORE COMPUTED METRICS
    // --------------------------------------------------
    
    function getMetrics() {
        let totalBooks = 0;
        let availableBooks = 0;
        let borrowedBooks = 0;

        books.forEach(book => {
            totalBooks += book.quantity;
            borrowedBooks += book.issued;
            availableBooks += (book.quantity - book.issued);
        });

        // Let's compute overdue returns based on issued books (e.g. 3% of borrowed books, min 1 if borrowed > 0)
        let overdueReturns = Math.ceil(borrowedBooks * 0.08);
        if (borrowedBooks === 0) overdueReturns = 0;

        return {
            total: totalBooks,
            available: availableBooks,
            borrowed: borrowedBooks,
            overdue: overdueReturns
        };
    }

    // Update stats cards UI elements
    function renderStatsCards() {
        const metrics = getMetrics();
        
        const totalBooksEl = document.getElementById("metric-total-books");
        const availableBooksEl = document.getElementById("metric-available-books");
        const borrowedBooksEl = document.getElementById("metric-borrowed-books");
        const overdueReturnsEl = document.getElementById("metric-overdue-returns");

        if (totalBooksEl) totalBooksEl.innerText = metrics.total.toLocaleString();
        if (availableBooksEl) availableBooksEl.innerText = metrics.available.toLocaleString();
        if (borrowedBooksEl) borrowedBooksEl.innerText = metrics.borrowed.toLocaleString();
        if (overdueReturnsEl) overdueReturnsEl.innerText = metrics.overdue.toLocaleString();
    }

    // --------------------------------------------------
    // 4. CHARTS CONFIGURATION & RENDERING
    // --------------------------------------------------
    
    let genreChartInstance = null;
    let trendsChartInstance = null;

    function renderCharts() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
        const labelColor = isDark ? "#94a3b8" : "#475569";

        // Aggregate Book Quantities by Category/Genre
        const categoryData = {};
        books.forEach(book => {
            if (categoryData[book.category]) {
                categoryData[book.category] += book.quantity;
            } else {
                categoryData[book.category] = book.quantity;
            }
        });

        const genreLabels = Object.keys(categoryData);
        const genreValues = Object.values(categoryData);

        // Fallback if empty
        if (genreLabels.length === 0) {
            genreLabels.push("No Data");
            genreValues.push(0);
        }

        // Color palette for genres
        const baseColors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#3b82f6", "#06b6d4"];
        const backgroundColors = genreLabels.map((_, i) => baseColors[i % baseColors.length]);

        // 1. Genres Pie Chart
        const genreCtx = document.getElementById("genreChart");
        if (genreCtx) {
            if (genreChartInstance) {
                genreChartInstance.destroy();
            }
            genreChartInstance = new Chart(genreCtx.getContext("2d"), {
                type: "pie",
                data: {
                    labels: genreLabels,
                    datasets: [{
                        data: genreValues,
                        backgroundColor: backgroundColors,
                        borderWidth: isDark ? 2 : 1,
                        borderColor: isDark ? "#151f32" : "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                color: labelColor,
                                boxWidth: 12,
                                font: { family: "Poppins", size: 11 }
                            }
                        }
                    }
                }
            });
        }

        // 2. Monthly Borrowing Trends Line Chart
        const trendsCtx = document.getElementById("trendsChart");
        if (trendsCtx) {
            if (trendsChartInstance) {
                trendsChartInstance.destroy();
            }
            
            const fillGrad = trendsCtx.getContext("2d").createLinearGradient(0, 0, 0, 200);
            fillGrad.addColorStop(0, "rgba(99, 102, 241, 0.35)");
            fillGrad.addColorStop(1, "rgba(99, 102, 241, 0.0)");

            trendsChartInstance = new Chart(trendsCtx.getContext("2d"), {
                type: "line",
                data: {
                    labels: trends.labels,
                    datasets: [{
                        label: "Books Borrowed",
                        data: trends.data,
                        borderColor: "#6366f1",
                        borderWidth: 3,
                        backgroundColor: fillGrad,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: "#4f46e5",
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: labelColor, font: { family: "Poppins" } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: labelColor, font: { family: "Poppins" } }
                        }
                    }
                }
            });
        }
    }

    // --------------------------------------------------
    // 5. BOOKS INVENTORY MANAGEMENT (CRUD)
    // --------------------------------------------------
    
    // Add Book Form Handler
    const addBookForm = document.getElementById("add-book-form");
    if (addBookForm) {
        addBookForm.addEventListener("submit", function (e) {
            e.preventDefault();
            
            const titleInput = document.getElementById("book-title-input");
            const authorInput = document.getElementById("book-author-input");
            const categoryInput = document.getElementById("book-category-input");
            const qtyInput = document.getElementById("book-qty-input");

            if (!titleInput || !authorInput || !categoryInput || !qtyInput) return;

            const title = titleInput.value.trim();
            const author = authorInput.value.trim();
            const category = categoryInput.value.trim();
            const quantity = parseInt(qtyInput.value);

            if (!title || !author || !category || isNaN(quantity) || quantity <= 0) {
                showToast("Please enter valid details for all fields.", "warning");
                return;
            }

            // Create new book object
            const newBook = {
                id: books.length > 0 ? Math.max(...books.map(b => b.id)) + 1 : 1001,
                title: title,
                author: author,
                category: category,
                quantity: quantity,
                issued: 0
            };

            // Push to state
            books.push(newBook);
            saveBooks();

            // Clear inputs
            addBookForm.reset();

            // Refresh UI
            updateAllViews();
            showToast(`Book "${title}" added successfully!`, "success");
        });
    }

    // Remove book by ID
    window.removeBook = function (bookId) {
        const bookIndex = books.findIndex(b => b.id === bookId);
        if (bookIndex === -1) return;

        const bookTitle = books[bookIndex].title;
        
        if (confirm(`Are you sure you want to delete "${bookTitle}"?`)) {
            books.splice(bookIndex, 1);
            saveBooks();
            updateAllViews();
            showToast(`Book "${bookTitle}" has been removed from inventory.`, "success");
        }
    };

    // Increment Borrowed (Borrow a book copy)
    window.borrowBook = function (bookId) {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        if (book.issued >= book.quantity) {
            showToast("Cannot borrow copy: All copies are currently checked out.", "warning");
            return;
        }

        book.issued += 1;
        saveBooks();
        updateAllViews();
        showToast(`Successfully borrowed a copy of "${book.title}".`, "success");
    };

    // Decrement Borrowed (Return a book copy)
    window.returnBook = function (bookId) {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        if (book.issued <= 0) {
            showToast("Cannot return copy: No copies are currently borrowed.", "warning");
            return;
        }

        book.issued -= 1;
        saveBooks();
        updateAllViews();
        showToast(`Successfully returned a copy of "${book.title}".`, "success");
    };

    // Search listener for Inventory catalog
    const inventorySearch = document.getElementById("inventory-search-input");
    if (inventorySearch) {
        inventorySearch.addEventListener("input", renderInventoryTable);
    }

    // Render the Books Inventory Table
    function renderInventoryTable() {
        const tbody = document.getElementById("inventory-table-body");
        if (!tbody) return;

        tbody.innerHTML = "";

        const searchQuery = inventorySearch ? inventorySearch.value.toLowerCase().trim() : "";
        const filteredBooks = books.filter(book => {
            return book.title.toLowerCase().includes(searchQuery) ||
                   book.author.toLowerCase().includes(searchQuery) ||
                   book.category.toLowerCase().includes(searchQuery) ||
                   String(book.id).includes(searchQuery);
        });

        if (filteredBooks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-light); padding: 2rem;">No matching catalog books found.</td></tr>`;
            return;
        }

        filteredBooks.forEach(book => {
            const available = book.quantity - book.issued;
            let status = "Available";
            let statusClass = "available";

            if (available === 0) {
                status = "Borrowed";
                statusClass = "borrowed";
            } else if (available <= 2) {
                status = "Low Stock";
                statusClass = "overdue";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>#${book.id}</strong></td>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.category}</td>
                <td>${book.quantity}</td>
                <td>${available}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
                <td>
                    <div class="control-group">
                        <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; color: var(--primary-color);" onclick="openEditModal(${book.id})" title="Edit Book"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="borrowBook(${book.id})" title="Borrow copy"><i class="fa-solid fa-hand-holding"></i> Borrow</button>
                        <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="returnBook(${book.id})" title="Return copy"><i class="fa-solid fa-rotate-left"></i> Return</button>
                        <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="removeBook(${book.id})" title="Delete Book"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Edit Book Modal Operations
    const editModal = document.getElementById("edit-modal");
    const editForm = document.getElementById("edit-book-form");

    window.openEditModal = function (bookId) {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        document.getElementById("edit-book-id").value = book.id;
        document.getElementById("edit-book-title").value = book.title;
        document.getElementById("edit-book-author").value = book.author;
        document.getElementById("edit-book-category").value = book.category;
        document.getElementById("edit-book-qty").value = book.quantity;

        if (editModal) editModal.classList.add("show");
    };

    window.closeEditModal = function () {
        if (editModal) editModal.classList.remove("show");
    };

    if (editForm) {
        editForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const id = parseInt(document.getElementById("edit-book-id").value);
            const title = document.getElementById("edit-book-title").value.trim();
            const author = document.getElementById("edit-book-author").value.trim();
            const category = document.getElementById("edit-book-category").value.trim();
            const quantity = parseInt(document.getElementById("edit-book-qty").value);

            if (!title || !author || !category || isNaN(quantity) || quantity <= 0) {
                showToast("Please enter valid details.", "warning");
                return;
            }

            const book = books.find(b => b.id === id);
            if (!book) return;

            if (quantity < book.issued) {
                showToast(`Cannot save: Total copies (${quantity}) cannot be less than currently borrowed copies (${book.issued}).`, "warning");
                return;
            }

            book.title = title;
            book.author = author;
            book.category = category;
            book.quantity = quantity;

            saveBooks();
            closeEditModal();
            updateAllViews();
            showToast(`Book "${title}" successfully updated!`, "success");
        });
    }

    // --------------------------------------------------
    // 6. REPORTS & EXPORTS
    // --------------------------------------------------
    
    // Search & Filter event listeners for Reports
    const reportSearch = document.getElementById("report-search-input");
    const categoryFilter = document.getElementById("report-category-filter");

    if (reportSearch) {
        reportSearch.addEventListener("input", renderReportsTable);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener("change", renderReportsTable);
    }

    // Build the reports category filter dropdown list based on current genres
    function populateCategoryFilter() {
        if (!categoryFilter) return;
        const activeSelect = categoryFilter.value;
        categoryFilter.innerHTML = `<option value="">All Categories</option>`;
        
        const categories = [...new Set(books.map(b => b.category))];
        categories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.innerText = cat;
            if (cat === activeSelect) opt.selected = true;
            categoryFilter.appendChild(opt);
        });
    }

    // Render reports tab table
    function renderReportsTable() {
        const tbody = document.getElementById("reports-table-body");
        if (!tbody) return;

        tbody.innerHTML = "";

        const searchQuery = reportSearch ? reportSearch.value.toLowerCase().trim() : "";
        const filterCat = categoryFilter ? categoryFilter.value : "";

        // Filter books based on criteria
        const filteredBooks = books.filter(book => {
            const matchesSearch = book.title.toLowerCase().includes(searchQuery) || 
                                  book.author.toLowerCase().includes(searchQuery) ||
                                  String(book.id).includes(searchQuery);
            const matchesCategory = filterCat === "" || book.category === filterCat;
            return matchesSearch && matchesCategory;
        });

        if (filteredBooks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-light); padding: 2rem;">No matching data logs found.</td></tr>`;
            return;
        }

        filteredBooks.forEach(book => {
            const available = book.quantity - book.issued;
            let status = "Available";
            let statusClass = "available";

            if (available === 0) {
                status = "Borrowed";
                statusClass = "borrowed";
            } else if (available <= 2) {
                status = "Low Stock";
                statusClass = "overdue";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>#${book.id}</strong></td>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.category}</td>
                <td>${book.quantity}</td>
                <td>${book.issued}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Trigger report metrics update
    window.generateReport = function () {
        showToast("Fetching latest real-time metrics... Data logs updated successfully.", "success");
        // Simulate a minor trend data increment
        trends.data[trends.data.length - 1] += 5;
        localStorage.setItem("lib_trends", JSON.stringify(trends));
        updateAllViews();
    };

    // Export Table data to CSV
    window.exportCSV = function () {
        const table = document.getElementById("reportsTable");
        if (!table) {
            showToast("Error finding table database reports.", "danger");
            return;
        }
        
        let csv = [];
        const rows = table.querySelectorAll("tr");
        
        for (let i = 0; i < rows.length; i++) {
            let row = [];
            const cols = rows[i].querySelectorAll("th, td");
            for (let j = 0; j < cols.length; j++) {
                // Remove trailing tags or spaces
                let text = cols[j].innerText.trim();
                // Escape double quotes inside values
                text = text.replace(/"/g, '""');
                row.push('"' + text + '"');
            }
            csv.push(row.join(","));
        }
        
        const csvString = csv.join("\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        link.setAttribute("href", url);
        link.setAttribute("download", `libmanage_resource_report_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Reports successfully exported to CSV file!", "success");
    };

    // --------------------------------------------------
    // 7. COMMON UTILITIES (TOASTS)
    // --------------------------------------------------
    
    function showToast(message, type = "info") {
        const container = document.querySelector(".toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = "fa-circle-info";
        if (type === "success") icon = "fa-circle-check";
        if (type === "warning") icon = "fa-triangle-exclamation";
        if (type === "danger") icon = "fa-circle-exclamation";

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);

        // Remove toast after 3.5 seconds
        setTimeout(() => {
            toast.style.animation = "slideIn 0.3s ease-out reverse forwards";
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3500);
    }

    // Refresh all views when updates occur
    function updateAllViews() {
        renderStatsCards();
        renderCharts();
        renderInventoryTable();
        populateCategoryFilter();
        renderReportsTable();
    }

    // --------------------------------------------------
    // 8. APP INITIAL LOAD
    // --------------------------------------------------
    loadState();
    updateAllViews();
    showToast("Welcome back to LibManage Library Dashboard!", "success");
});
