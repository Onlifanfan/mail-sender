document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.custom-mouse-pointer');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

document.addEventListener('DOMContentLoaded', function () {
    // --- Elements ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const newCampaignBtn = document.getElementById('newCampaignBtn');
    const campaignForm = document.getElementById('campaignForm');
    const userNameSpan = document.getElementById('userName');
    const campaignsList = document.getElementById('campaignsList');
    const inboxSection = document.getElementById('inbox');
    const inboxMessagesDiv = document.getElementById('inbox-messages');
    const themeToggle = document.getElementById('theme-toggle');
    const themeStylesheet = document.getElementById('theme-stylesheet');
    const body = document.body;

    // --- Constants ---
    const emailsPerPage = 10;
    const themes = ['styles/light/dashboard.css', 'styles/dark/dashboard.css'];

    // --- Variables ---
    let currentPage = 1;
    let allEmails = [];
    let nextPageToken = null;
    let currentThemeIndex = 0;

    // --- Load More Button ---
    const loadMoreButton = document.createElement('button');
    loadMoreButton.textContent = 'Load More';
    loadMoreButton.classList.add('load-more-button');
    loadMoreButton.addEventListener('click', function (event) {  // ADD event listener
        event.preventDefault(); // Prevent default scroll-to-top behavior
        loadMoreEmails();
    });

    // --- Theme Handling ---
    function setTheme(theme) {
        themeStylesheet.setAttribute('href', theme);
        localStorage.setItem('theme', theme);
    }

    function initializeTheme() {
        const storedTheme = localStorage.getItem('theme');

        if (storedTheme) {
            setTheme(storedTheme);
            currentThemeIndex = themes.indexOf(storedTheme);
            if (currentThemeIndex === -1) {
                currentThemeIndex = 0;
                setTheme(themes[0]);
            }
        } else {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                currentThemeIndex = 1;
            } else {
                currentThemeIndex = 0;
            }
            setTheme(themes[currentThemeIndex]);
        }
    }

    // --- Email Handling ---
    async function loadEmails(page = 1, token = null) {
        inboxMessagesDiv.innerHTML = 'Loading emails...';
        try {
            let url = `/api/getEmails?page=${page}&limit=${emailsPerPage}`;
            if (token) {
                url += `&pageToken=${token}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch emails: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const newEmails = data.emails || [];
            nextPageToken = data.nextPageToken || null;

            if (page === 1) {
                allEmails = newEmails;
            } else {
                allEmails = allEmails.concat(newEmails);
            }

            displayEmails(allEmails);

        } catch (error) {
            console.error('Error fetching emails:', error);
            inboxMessagesDiv.innerHTML = `<p>Error loading emails: ${error.message}</p>`;
        } finally {
            updateLoadMoreButtonVisibility();
        }
    }

    function displayEmails(emails) {
        // Store the current scroll position
        const scrollPosition = inboxMessagesDiv.scrollTop;

        // Clear only the email list, keep the "Load More" button
        const emailList = document.createElement('div');
        emailList.id = 'email-list'; // Assign an ID for easier replacement
        inboxMessagesDiv.innerHTML = '';
        inboxMessagesDiv.appendChild(emailList);

        if (emails.length === 0) {
            emailList.innerHTML = '<p>No emails found.</p>';
            updateLoadMoreButtonVisibility();
            return;
        }

        emails.forEach(email => {
            const emailDiv = document.createElement('div');
            emailDiv.classList.add('email-message');
            emailDiv.innerHTML = `
                <h4>${email.subject}</h4>
                <p><strong>From:</strong> ${email.sender}</p>
                <p><strong>Date:</strong> ${email.date}</p>
                <p>${email.snippet}</p>
            `;

            emailDiv.addEventListener('click', () => showEmailDetails(email));
            emailList.appendChild(emailDiv);
        });
        inboxMessagesDiv.appendChild(loadMoreButton); // Add the button

        // Restore the scroll position after adding the new emails
        inboxMessagesDiv.scrollTop = scrollPosition;
    }

    async function loadMoreEmails() {
        currentPage++;
        await loadEmails(currentPage, nextPageToken);
    }

    function showEmailDetails(email) {
        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('email-details');

        detailsDiv.innerHTML = `
            <h3>${email.subject}</h3>
            <p><strong>From:</strong> ${email.sender}</p>
            <p><strong>Date:</strong> ${email.date}</p>
            <div class="email-body">${email.body}</div>
            <button class="close-button">Close</button>
        `;

        const closeButton = detailsDiv.querySelector('.close-button');
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            detailsDiv.remove();
        });

        inboxMessagesDiv.appendChild(detailsDiv);
    }

    // --- Helper Function ---
    function updateLoadMoreButtonVisibility() {
        if (!nextPageToken) {
            loadMoreButton.style.display = 'none';
        } else {
            loadMoreButton.style.display = 'block';
        }
    }

    // --- Campaign Handling ---
    async function fetchCampaignData() {
        try {
            const response = await fetch('/api/getCampaignData');
            if (!response.ok) throw new Error('Failed to fetch campaigns');
            const data = await response.json();
            return data.campaigns;
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            showToast('Failed to load campaigns', true);
            return [];
        }
    }

    function displayCampaigns(campaigns) {
        if (!campaignsList) return;

        campaignsList.innerHTML = '';

        if (campaigns.length === 0) {
            campaignsList.innerHTML = `
                <div class="empty-state">
                    <p>No campaigns found. Create your first campaign!</p>
                </div>
            `;
            return;
        }

        campaigns.forEach(campaign => {
            const campaignCard = document.createElement('div');
            campaignCard.className = 'campaign-card';
            campaignCard.innerHTML = `
                <div class="campaign-header">
                    <h3>${campaign.campaignName}</h3>
                    <span class="status">${campaign.status || 'Active'}</span>
                </div>
                <div class="campaign-details">
                    <p><strong>Business:</strong> ${campaign.businessName}</p>
                    <p><strong>Industry:</strong> ${campaign.industry}</p>
                    <p><strong>Language:</strong> ${campaign.language}</p>
                    <p><strong>Follow-ups:</strong> ${campaign.numberOfFollowUps}</p>
                </div>
                <div class="campaign-footer">
                    <span class="date">Created: ${new Date(campaign.creationDate).toLocaleDateString()}</span>
                    <button class="btn-primary" onclick="viewCampaignDetails('${campaign.id}')">
                        View Details
                    </button>
                </div>
            `;
            campaignsList.appendChild(campaignCard);
        });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const formData = {
            campaignName: document.getElementById('campaignName').value,
            businessName: document.getElementById('businessName').value,
            industry: document.getElementById('industry').value,
            targetAudience: document.getElementById('targetAudience').value,
            language: document.querySelector('#language')?.value || '',
            followUpCount: document.getElementById('followUpCount').value
        };

        try {
            const response = await fetch('/api/setCampaignData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save campaign');
            }

            showToast('Campaign successfully created!');
            campaignForm.reset();
            updateActivityList(`New campaign "${formData.campaignName}" created`);
            updateActiveSection('campaigns');

        } catch (error) {
            showToast(error.message || 'Failed to create campaign', true);
            console.error('Campaign creation error:', error);
        }
    }

    // --- Dashboard ---
    function updateDashboard() {
        document.getElementById('totalSent').textContent = '1,234';
        document.getElementById('openRate').textContent = '45%';
        document.getElementById('replyRate').textContent = '15%';
        document.getElementById('meetingsBooked').textContent = '8';
    }

    function updateActivityList(activity) {
        const activityList = document.getElementById('activityList');
        const newActivity = document.createElement('li');
        newActivity.textContent = activity;

        if (activityList.firstChild) {
            activityList.insertBefore(newActivity, activityList.firstChild);
        } else {
            activityList.appendChild(newActivity);
        }

        while (activityList.children.length > 5) {
            activityList.removeChild(activityList.lastChild);
        }
    }

    // --- Login Status ---
    function checkLoginStatus() {
        fetch('/api/check-login')
            .then(response => {
                if (!response.ok) {
                    window.location.href = '/login';
                    throw new Error('Not logged in');
                }
                return response.json();
            })
            .then(data => {
                userNameSpan.textContent = data.username || 'Guest';
            })
            .catch(error => {
                console.error('Login check error:', error);
                userNameSpan.textContent = 'Guest';
                window.location.href = '/login';
            });
    }

    // --- Toast Message ---
    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : 'success'}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // --- Navigation Handling ---
    function updateActiveSection(sectionId) {
        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-section') === sectionId);
        });

        sections.forEach(section => {
            section.classList.toggle('hidden', section.id !== sectionId);
        });

        if (sectionId === 'campaigns') {
            fetchCampaignData().then(campaigns => displayCampaigns(campaigns));
        }

        if (sectionId === 'inbox') {
            loadEmails();
        }
    }

    // --- Event Listeners ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            updateActiveSection(link.getAttribute('data-section'));
        });
    });

    newCampaignBtn.addEventListener('click', () => {
        updateActiveSection('newCampaign');
    });

    campaignForm.addEventListener('submit', handleFormSubmit);
    themeToggle.addEventListener('click', () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        setTheme(themes[currentThemeIndex]);
    });


    // Logout function
    document.getElementById('logout-link').addEventListener('click', function (event) {
        event.preventDefault();

        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (response.ok) {
                    alert('Odjava uspješna!');
                    window.location.href = '/';
                } else {
                    alert('Odjava nije uspjela. Molimo pokušajte ponovno.');
                }
            })
            .catch(error => console.error('Greška tijekom odjave:', error));
    });

    // --- Initialization ---
    initializeTheme();
    checkLoginStatus();
    updateDashboard();
    updateActiveSection('dashboard');
});
