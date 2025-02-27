document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm")
  const registerForm = document.getElementById("registerForm")
  const switchToRegister = document.getElementById("switchToRegister")
  const switchToLogin = document.getElementById("switchToLogin")
  const loginFormBox = document.querySelector(".login-form")
  const registerFormBox = document.querySelector(".register-form")

  // Check if it's a touch device
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0

  // Custom mouse pointer - only for non-touch devices
  if (!isTouchDevice) {
    const customPointer = document.createElement("div")
    customPointer.className = "custom-mouse-pointer"
    document.body.appendChild(customPointer)

    document.addEventListener("mousemove", (e) => {
      customPointer.style.left = `${e.clientX}px`
      customPointer.style.top = `${e.clientY}px`
    })

    // Hide default mouse cursor
    document.body.style.cursor = "none"
  }

  // Form switching
  switchToRegister.addEventListener("click", (e) => {
    e.preventDefault()
    loginFormBox.classList.add("inactive")
    registerFormBox.classList.add("active")
  })

  switchToLogin.addEventListener("click", (e) => {
    e.preventDefault()
    registerFormBox.classList.remove("active")
    loginFormBox.classList.remove("inactive")
  })

  // Utility functions
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validatePassword = (password) => password.length >= 8

  const showError = (input, message) => {
    const formGroup = input.parentElement
    formGroup.classList.add("error")
    const error = formGroup.querySelector(".error-message") || document.createElement("div")
    error.className = "error-message"
    error.textContent = message
    if (!formGroup.querySelector(".error-message")) {
      formGroup.appendChild(error)
    }
    error.style.display = "block"
  }

  const hideError = (input) => {
    const formGroup = input.parentElement
    formGroup.classList.remove("error")
    const error = formGroup.querySelector(".error-message")
    if (error) {
      error.style.display = "none"
    }
  }

  const showToast = (message, isError = false) => {
    const toast = document.createElement("div")
    toast.className = `toast ${isError ? "error" : "success"}`
    toast.textContent = message
    document.body.appendChild(toast)
    toast.offsetHeight // Force reflow
    toast.classList.add("show")
    setTimeout(() => {
      toast.classList.remove("show")
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }

  const setLoadingState = (button, isLoading) => {
    if (isLoading) {
      button.disabled = true
      button.dataset.originalText = button.textContent
      const spinner = document.createElement("div")
      spinner.className = "spinner"
      button.textContent = ""
      button.appendChild(spinner)
    } else {
      button.disabled = false
      button.textContent = button.dataset.originalText
    }
  }

  // Login form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const userInput = document.getElementById("loginEmail")
    const password = document.getElementById("loginPassword")
    let isValid = true

    if (!validateEmail(userInput.value)) {
      showError(userInput, "Please enter a valid email address")
      isValid = false
    } else {
      hideError(userInput)
    }

    if (!validatePassword(password.value)) {
      showError(password, "Password must be at least 8 characters")
      isValid = false
    } else {
      hideError(password)
    }

    if (isValid) {
      const submitBtn = loginForm.querySelector(".submit-btn")
      setLoadingState(submitBtn, true)

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            userInput: userInput.value.trim(),
            password: password.value,
            deviceId: "browser",
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Login failed")
        }

        showToast("Login successful!")
        loginForm.reset()

        // Handle successful login (e.g., redirect)
        window.location.href = "/dashboard" // Adjust this to your needs
      } catch (error) {
        showToast(error.message || "Login failed. Please try again.", true)
        console.error("Login error:", error)
      } finally {
        setLoadingState(submitBtn, false)
      }
    }
  })

  // Register form submission
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const username = document.getElementById("registerName")
    const email = document.getElementById("registerEmail")
    const password = document.getElementById("registerPassword")
    const confirmPassword = document.getElementById("confirmPassword")
    let isValid = true

    if (username.value.trim() === "") {
      showError(username, "Username is required")
      isValid = false
    } else {
      hideError(username)
    }

    if (!validateEmail(email.value)) {
      showError(email, "Please enter a valid email address")
      isValid = false
    } else {
      hideError(email)
    }

    if (!validatePassword(password.value)) {
      showError(password, "Password must be at least 8 characters")
      isValid = false
    } else {
      hideError(password)
    }

    if (password.value !== confirmPassword.value) {
      showError(confirmPassword, "Passwords do not match")
      isValid = false
    } else {
      hideError(confirmPassword)
    }

    if (isValid) {
      const submitBtn = registerForm.querySelector(".submit-btn")
      setLoadingState(submitBtn, true)

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            username: username.value.trim(),
            email: email.value.trim(),
            password: password.value,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Registration failed")
        }

        showToast(data.message || "Registration successful!")
        registerForm.reset()
        registerFormBox.classList.remove("active")
        loginFormBox.classList.remove("inactive")

        // Handle successful registration (e.g., redirect)
        if (data.redirect) {
          window.location.href = data.redirect
        }
      } catch (error) {
        showToast(error.message || "Registration failed. Please try again.", true)
        console.error("Registration error:", error)
      } finally {
        setLoadingState(submitBtn, false)
      }
    }
  })

  // Password strength indicator
  const passwordInputs = document.querySelectorAll('input[type="password"]')
  passwordInputs.forEach((input) => {
    input.addEventListener("input", () => {
      const line = input.nextElementSibling.nextElementSibling
      const strength = input.value.length
      const weak = strength >= 8
      const medium = weak && /[A-Z]/.test(input.value) && /[a-z]/.test(input.value) && /[0-9]/.test(input.value)
      const strong = medium && /[^A-Za-z0-9]/.test(input.value)

      if (strong) {
        line.style.backgroundColor = "#00ff00"
      } else if (medium) {
        line.style.backgroundColor = "#ffa500"
      } else if (weak) {
        line.style.backgroundColor = "#ff4500"
      } else {
        line.style.backgroundColor = "#ff4500"
        line.style.transform = "scaleX(0)"
        return
      }

      line.style.transform = "scaleX(1)"
    })
  })
  const themeToggle = document.getElementById("theme-toggle")
  const themeStylesheet = document.getElementById("theme-stylesheet")
  const body = document.body

  const themes = ["styles/light/loginl.css", "styles/dark/login.css"]
  let currentThemeIndex = 0

  // Function to set the theme
  function setTheme(theme) {
    themeStylesheet.setAttribute("href", theme)
    localStorage.setItem("theme", theme) // Save the theme to localStorage
  }

  // Get the stored theme from localStorage
  const storedTheme = localStorage.getItem("theme")

  if (storedTheme) {
    setTheme(storedTheme)
    currentThemeIndex = themes.indexOf(storedTheme)
    if (currentThemeIndex === -1) {
      currentThemeIndex = 0 // Reset to default if stored theme is invalid
      setTheme(themes[0])
    }
  } else {
    // If no theme is stored, set the initial theme based on system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      currentThemeIndex = 1
    } else {
      currentThemeIndex = 0
    }
    setTheme(themes[currentThemeIndex])
  }

  // Toggle the theme
  themeToggle.addEventListener("click", () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length
    setTheme(themes[currentThemeIndex])
  })
})

