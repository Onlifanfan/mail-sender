document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.custom-mouse-pointer');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

document.addEventListener('DOMContentLoaded', function () {
        const dashboardButton = document.querySelector('.dashboard-button');

        async function checkLoginStatus() {
            try {
                const response = await fetch('/api/check-login');
                const data = await response.json();

                if (data.loggedIn) {
                    dashboardButton.style.display = 'inline-block';
                    dashboardButton.href = '/dashboard';
                } else {
                    dashboardButton.style.display = 'none';
                }
            } catch (error) {
                console.error('Error checking login status:', error);
            }
        }

        checkLoginStatus();


    const themeToggle = document.getElementById('theme-toggle');
    const themeStylesheet = document.getElementById('theme-stylesheet');
    const body = document.body;

    const themes = ['styles/light.css', 'styles/dark.css'];
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
