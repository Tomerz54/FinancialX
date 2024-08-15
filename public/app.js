function escapeHTML(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validatePassword() {
    const password = document.getElementById('password').value;
    const username = document.getElementById('name').value;
    const email = document.getElementById('email').value;

    const sanitizedUsername = escapeHTML(username);

    const errors = [];
    
    // Password validation checks
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const noSpecialChars = !/[<>\/]/.test(password);

    // Update checkboxes based on validation
    document.getElementById('min-length').checked = minLength;
    document.getElementById('uppercase').checked = hasUppercase;
    document.getElementById('lowercase').checked = hasLowercase;
    document.getElementById('number').checked = hasNumber;
    document.getElementById('no-special').checked = noSpecialChars;

    // Error handling
    const errorMessagesDiv = document.getElementById('password-errors');
    if (!minLength) {
        errors.push("Password must be at least 8 characters long.");
    }
    if (!hasUppercase) {
        errors.push("Password must contain at least one uppercase letter.");
    }
    if (!hasLowercase) {
        errors.push("Password must contain at least one lowercase letter.");
    }
    if (!hasNumber) {
        errors.push("Password must contain at least one number.");
    }
    if (!noSpecialChars) {
        errors.push("Password must not contain '<', '>', or '/' characters.");
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errors.push("Please enter a valid email address.");
    }

    if (errors.length > 0) {
        errorMessagesDiv.innerHTML = errors.join("<br>"); // Display errors as HTML
    } else {
        errorMessagesDiv.innerHTML = ''; // Clear errors if no issues
    }

    // Update password strength display
    updatePasswordStrength(password);
}

function togglePassword() {
    const passwordField = document.getElementById('password');
    const showPasswordSpan = document.querySelector('.toggle-password');
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text'; // Show the password
        showPasswordSpan.textContent = 'Hide Password'; // Update text
    } else {
        passwordField.type = 'password'; // Hide the password
        showPasswordSpan.textContent = 'Show Password'; // Update text
    }
}

function password_secure() {
    let password = document.getElementById("password");
    let power = document.getElementById("strength-meter"); // Update to match your element ID

    password.addEventListener('input', function() {
        let point = 0;
        let value = password.value;

        // Define width and color arrays
        let widthPower = ["1%", "25%", "50%", "75%", "100%"];
        let colorPower = ["#D73F40", "#DC6551", "#F2B84F", "#BDE952", "#3ba62f"];

        // Define password strength criteria
        if (value.length >= 6) {
            let arrayTest = [/[0-9]/, /[a-z]/, /[A-Z]/, /[^0-9a-zA-Z]/];
            arrayTest.forEach((item) => {
                if (item.test(value)) {
                    point += 1;
                }
            });
        }

        // Update the progress bar's width and color
        power.style.width = widthPower[point];
        power.style.backgroundColor = colorPower[point];

        // Optional: Update strength text
        let strengthText = document.getElementById("strength-text");
        let strengthLabel;

        switch (point) {
            case 0:
                strengthLabel = 'Very Weak';
                break;
            case 1:
                strengthLabel = 'Weak';
                break;
            case 2:
                strengthLabel = 'Moderate';
                break;
            case 3:
                strengthLabel = 'Good';
                break;
            case 4:
                strengthLabel = 'Strong';
                break;
        }

        if (strengthText) {
            strengthText.textContent = strengthLabel;
        }
    });
}

function openIncome(){
    window.location.href = '/add-income';
}

function openExpenses(){
    window.location.href = '/add-expenses';
}
// Initialize password strength functionality once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    password_secure();
});


