document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle")
  const mainNav = document.getElementById("main-nav")

  if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener("click", function () {
      mainNav.classList.toggle("active")

      // Change hamburger to X
      const spans = this.querySelectorAll("span")
      if (spans.length === 3) {
        if (mainNav.classList.contains("active")) {
          spans[0].style.transform = "rotate(45deg) translate(5px, 5px)"
          spans[1].style.opacity = "0"
          spans[2].style.transform = "rotate(-45deg) translate(7px, -6px)"
        } else {
          spans[0].style.transform = "none"
          spans[1].style.opacity = "1"
          spans[2].style.transform = "none"
        }
      }
    })

    // Close menu when clicking outside
    document.addEventListener("click", (event) => {
      if (
        !mainNav.contains(event.target) &&
        !mobileMenuToggle.contains(event.target) &&
        mainNav.classList.contains("active")
      ) {
        mainNav.classList.remove("active")
        const spans = mobileMenuToggle.querySelectorAll("span")
        if (spans.length === 3) {
          spans[0].style.transform = "none"
          spans[1].style.opacity = "1"
          spans[2].style.transform = "none"
        }
      }
    })

    // Close menu when clicking on a nav link
    const navLinks = mainNav.querySelectorAll("a")
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("active")
        const spans = mobileMenuToggle.querySelectorAll("span")
        if (spans.length === 3) {
          spans[0].style.transform = "none"
          spans[1].style.opacity = "1"
          spans[2].style.transform = "none"
        }
      })
    })
  }

  // Custom mouse pointer - only on desktop
  if (window.innerWidth > 768) {
    const cursor = document.querySelector(".custom-mouse-pointer")
    if (cursor) {
      document.addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px"
        cursor.style.top = e.clientY + "px"
      })
    }
  } else {
    // Hide custom cursor on mobile
    const cursor = document.querySelector(".custom-mouse-pointer")
    if (cursor) {
      cursor.style.display = "none"
    }
  }

  // Dashboard button and logout button visibility
  const dashboardButton = document.querySelector(".dashboard-button")
  const logoutButton = document.querySelector(".logout-button")

  async function checkLoginStatus() {
    try {
      const response = await fetch("/api/check-login")
      const data = await response.json()

      if (data.loggedIn) {
        dashboardButton.style.display = "inline-block"
        dashboardButton.href = "/dashboard"
        logoutButton.style.display = "inline-block"
        logoutButton.href = "/logout"
      } else {
        dashboardButton.style.display = "none"
        logoutButton.style.display = "none"
      }
    } catch (error) {
      console.error("Error checking login status:", error)
    }
  }

  if (dashboardButton && logoutButton) {
    checkLoginStatus()
  }

    // Theme toggle
    const themeToggle = document.getElementById("theme-toggle")
    const themeToggleMobile = document.getElementById("theme-toggle-mobile")
    const themeStylesheet = document.getElementById("theme-stylesheet")

    if ((themeToggle || themeToggleMobile) && themeStylesheet) {
        const themes = ["light", "dark"]
        let currentThemeIndex = 0

        // Function to set the theme
        function setTheme(theme) {
            themeStylesheet.setAttribute("href", `/styles/${theme}/landing.css`)
            localStorage.setItem("theme", theme) // Save only "light" or "dark" to localStorage
            console.log("Stored theme:", theme)
        }

        // Get the stored theme from localStorage
        const storedTheme = localStorage.getItem("theme")

        if (storedTheme && themes.includes(storedTheme)) {
            setTheme(storedTheme)
            currentThemeIndex = themes.indexOf(storedTheme)
        } else {
            // If no theme is stored or invalid, set the initial theme based on system preference
            if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
                currentThemeIndex = 1
            } else {
                currentThemeIndex = 0
            }
            setTheme(themes[currentThemeIndex])
        }

        // Toggle the theme function
        function toggleTheme() {
            currentThemeIndex = (currentThemeIndex + 1) % themes.length
            setTheme(themes[currentThemeIndex])
        }

        // Add event listeners to both theme toggle buttons
        if (themeToggle) {
            themeToggle.addEventListener("click", toggleTheme)
        }
        if (themeToggleMobile) {
            themeToggleMobile.addEventListener("click", toggleTheme)
        }
    }


  // Logout functionality
  const logoutLink = document.getElementById("logout-link")
  if (logoutLink) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault()

      fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          if (response.ok) {
            window.location.href = "/"
          } else {
            console.error("Logout failed")
          }
        })
        .catch((error) => console.error("Error during logout:", error))
    })
  }

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault()

        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            
            window.scrollTo({
                top: targetElement.offsetTop - 80, // Adjust for header height
                behavior: "smooth",
            })
        }
    })
  })
})

