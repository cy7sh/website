// Update root html class to set CSS colors
const toggleDarkMode = () => {
  const root = document.querySelector('html');
  root.classList.toggle('light');
}

// Update local storage value for colorScheme
const toggleColorScheme = () => {
  const colorScheme = localStorage.getItem('colorScheme');
  if (colorScheme === 'light') localStorage.setItem('colorScheme', 'dark');
  else localStorage.setItem('colorScheme', 'light');
}

// Set toggle input handler
const toggle = document.querySelector('#color-mode-switch input[type="checkbox"]');
if (toggle) {
  toggle.onclick = () => {
    toggleDarkMode();
    toggleColorScheme();
  }
} else {
  console.log("error: toggle not found");
}

// Check for color scheme on init
const checkColorScheme = () => {
  const colorScheme = localStorage.getItem('colorScheme');
  // Default to dark for first view
  if (colorScheme === null || colorScheme === undefined) localStorage.setItem('colorScheme', 'dark');
  // If previously saved to light, toggle switch and update colors
  if (colorScheme === 'light') {
    toggle.checked = false;
    toggleDarkMode();
  }
}
checkColorScheme();
