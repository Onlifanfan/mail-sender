document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.custom-mouse-pointer');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

document.addEventListener('DOMContentLoaded', function () {
        const dashboardButton = document.querySelector('.dashboard-button');
        const logoutButton = document.querySelector('.logout-button');

        async function checkLoginStatus() {
            try {
                const response = await fetch('/api/check-login');
                const data = await response.json();

                if (data.loggedIn) {
                    dashboardButton.style.display = 'inline-block';
                    dashboardButton.href = '/dashboard';
                    logoutButton.style.display = 'inline-block';
                    logoutButton.href = "/logout"
                } else {
                    dashboardButton.style.display = 'none';
                    logoutButton.style.display = 'none';
                }
            } catch (error) {
                console.error('Error checking login status:', error);
            }
        }

        checkLoginStatus();


    const themeToggle = document.getElementById('theme-toggle');
    const themeStylesheet = document.getElementById('theme-stylesheet');
    const body = document.body;

    const themes = ['styles/light/landing.css', 'styles/dark/landing.css'];
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
            .catch(error => console.error('Greška tijekom odjave:', error));
    });
    
});
