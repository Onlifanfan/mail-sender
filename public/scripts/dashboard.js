document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const newCampaignBtn = document.getElementById('newCampaignBtn');
    const campaignForm = document.getElementById('campaignForm');
    const dashboardSection = document.getElementById('dashboard');
    const newCampaignSection = document.getElementById('newCampaign');
    const userNameSpan = document.getElementById('userName');
    const campaignsList = document.getElementById('campaignsList');

    // Navigation handling
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            updateActiveSection(link.getAttribute('data-section'));
        });
    });

    // New Campaign button handling
    newCampaignBtn.addEventListener('click', () => {
        updateActiveSection('newCampaign');
    });

    // Form submission handling
    campaignForm.addEventListener('submit', handleFormSubmit);

    // Initialize dashboard data
    updateDashboard();

    // Check login status
    checkLoginStatus();

    // Helper functions
    async function updateActiveSection(sectionId) {
        // Update navigation links
        navLinks.forEach(link => {
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Update visible section
        sections.forEach(section => {
            if (section.id === sectionId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });

        // Fetch campaigns if needed
        if (sectionId === 'campaigns') {
            const campaigns = await fetchCampaignData();
            displayCampaigns(campaigns);
        }
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

    function updateDashboard() {
        // Update dashboard statistics
        document.getElementById('totalSent').textContent = '1,234';
        document.getElementById('openRate').textContent = '45%';
        document.getElementById('replyRate').textContent = '15%';
        document.getElementById('meetingsBooked').textContent = '8';
    }

    function updateActivityList(activity) {
        const activityList = document.getElementById('activityList');
        const newActivity = document.createElement('li');
        newActivity.textContent = activity;

        // Add new activity at the top of the list
        if (activityList.firstChild) {
            activityList.insertBefore(newActivity, activityList.firstChild);
        } else {
            activityList.appendChild(newActivity);
        }

        // Keep only the last 5 activities
        while (activityList.children.length > 5) {
            activityList.removeChild(activityList.lastChild);
        }
    }

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

    function checkLoginStatus() {
        fetch('/api/check-login')
            .then(response => {
                if (!response.ok) {
                    window.location.href = '/login'; // Redirect to login page
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
                window.location.href = '/login'; // Redirect to login page on any error
            });
    }


    function showToast(message, isError = false) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : 'success'}`;
        toast.textContent = message;

        // Add toast to the document
        document.body.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Initialize by showing dashboard
    updateActiveSection('dashboard');

    const themeToggle = document.getElementById('theme-toggle');
    const themeStylesheet = document.getElementById('theme-stylesheet');
    const body = document.body;

    const themes = ['styles/dashboardl.css', 'styles/dashboard.css'];
    let currentThemeIndex = 0;

    // Function to set the theme
    function setTheme(theme) {
        themeStylesheet.setAttribute('href', theme);
        localStorage.setItem('theme', theme); // Save the theme to localStorage
    }

    // Get the stored theme from localStorage
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme) {
        setTheme(storedTheme);
        currentThemeIndex = themes.indexOf(storedTheme);
        if (currentThemeIndex === -1) {
            currentThemeIndex = 0; // Reset to default if stored theme is invalid
            setTheme(themes[0]);
        }
    } else {
        // If no theme is stored, set the initial theme based on system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            currentThemeIndex = 1;
        } else {
            currentThemeIndex = 0;
        }
        setTheme(themes[currentThemeIndex]);
    }

    // Toggle the theme
    themeToggle.addEventListener('click', () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        setTheme(themes[currentThemeIndex]);
    });

    
});
