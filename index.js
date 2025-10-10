const Bottleneck = require("bottleneck");
const fs = require("fs");
const path = require("path");
const ipc = require("electron").ipcRenderer;
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");
// const archiver = require('archiver');
const AdmZip = require("adm-zip");
const { electron } = require("process");
const { dialog, ipcMain, ipcRenderer } = require("electron");

fileName = document.getElementById("fileName");
fileContents = document.getElementById("fileContents");
fileContents2 = document.getElementById("fileContents2");
btnRead = document.getElementById("btnRead");

let pathName = path.join(__dirname, "Files");
let mail_ID = "";
let password = "";
let mailSubject = "";
let mailBody = "";
let dirPath = "";
let Data = [];
let path1 = "";

// chk password visibiity
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("Password");
togglePassword.addEventListener("click", function () {
  if (passwordInput.getAttribute("type") === "password") {
    passwordInput.setAttribute("type", "text");
  } else {
    passwordInput.setAttribute("type", "password");
  }

  togglePassword.classList.toggle("fa-eye-slash");
});

// send files
const element = document.getElementById("sendFiles");
element.addEventListener("click", sendFiles);

// excel sheet upload
function upload(event) {
  // console.log("The Upload Function is called")
  ipc.send("open-file-dialog-for-file");
  ipc.on("selected-file", function (event, path) {
    //event.preventDefault();
    // let path1 = path.basename(pathName);
    path1 = path;
    path1 = path1.toString();
    let index = path1.lastIndexOf("\\");
    let fileName = path1.slice(index + 1);
    document.getElementById("excel").value = fileName;

    hideValidationMessage(document.getElementById("excel"));
  });
}

// get the directory path
function onDirectorySelected(event) {
  ipcRenderer.send("open-directory-dialog");

  ipcRenderer.on("selected-directory", (event, path) => {
    // event.preventDefault();
    console.log(`Selected directory: ${path}`);
    dirPath = `${path}`.toString() + "/";

    console.log(dirPath);
    document.getElementById("dirPath").value = dirPath;

    hideValidationMessage(document.getElementById("dirPath"));
  });
}

// show validation msg
function showValidationMessage(inputElement, message) {
  // Check if a previous validation message exists for the input field
  const existingValidationMessage = inputElement.parentNode.querySelector(
    ".validation-message"
  );
  if (existingValidationMessage) {
    existingValidationMessage.remove();
  }

  const validationMessage = document.createElement("div");
  validationMessage.className = "validation-message";
  validationMessage.textContent = message;
  inputElement.parentNode.appendChild(validationMessage);
}

// hide validation msg
function hideValidationMessage(inputElement) {
  const validationMessage = inputElement.parentNode.querySelector(
    ".validation-message"
  );
  if (validationMessage) {
    validationMessage.remove();
  }
}

// email validation
function isEmailValid(mail_ID) {
  // Regular expression to validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(mail_ID);
}

// form validation
function formValidation() {
        mail_ID = document.getElementById("Email").value.trim();
        password = document.getElementById("Password").value.trim();
  const excelFile = document.getElementById("excel").value.trim();
  const dirPath = document.getElementById("dirPath").value.trim();

  const emailInput = document.getElementById("Email");
  emailInput.addEventListener("focus", () => hideValidationMessage(emailInput));
  emailInput.addEventListener("input", () => hideValidationMessage(emailInput));

  const passwordInput = document.getElementById("Password");
  passwordInput.addEventListener("focus", () =>
    hideValidationMessage(passwordInput)
  );
  passwordInput.addEventListener("input", () =>
    hideValidationMessage(passwordInput)
  );

  const excelInput = document.getElementById("excel");
  excelInput.addEventListener("focus", () => hideValidationMessage(excelInput));
  excelInput.addEventListener("input", () => hideValidationMessage(excelInput));

  const dirPathInput = document.getElementById("dirPath");

  if (dirPathInput.value === "") {
    hideValidationMessage(dirPathInput);
  }

  dirPathInput.addEventListener("focus", () =>
    hideValidationMessage(dirPathInput)
  );
  dirPathInput.addEventListener("input", () =>
    hideValidationMessage(dirPathInput)
  );

  // chk email not blank & valid email
  if (mail_ID.trim() === "") {
    showValidationMessage(
      document.getElementById("Email"),
      "Please enter an email address."
    );
    return false;
  } else if (!isEmailValid(mail_ID)) {
    showValidationMessage(
      document.getElementById("Email"),
      "Please enter a valid email address."
    );
    return false;
  } else {
    hideValidationMessage(document.getElementById("Email"));
  }

  // chk pass not blanked
  if (password.trim() === "") {
    showValidationMessage(
      document.getElementById("Password"),
      "Please enter a password."
    );
    return false;
  } else {
    hideValidationMessage(document.getElementById("Password"));
  }
  passwordInput.addEventListener("focus", () =>
    hideValidationMessage(passwordInput)
  );

  // chk excel not blank & file format correct
  if (excelFile.trim() === "") {
    showValidationMessage(
      document.getElementById("excel"),
      "Please select a file."
    );
    return false;
  } else if (!/\.(csv|xls|xlsx)$/i.test(excelFile)) {
    showValidationMessage(
      document.getElementById("excel"),
      "Please choose a valid Excel CSV, XLS, or XLSX file."
    );
    return false;
  } else {
    hideValidationMessage(document.getElementById("excel"));
  }

  // chk directory path not blank
  if (dirPath.trim() === "") {
    showValidationMessage(
      document.getElementById("dirPath"),
      "Please choose a directory path."
    );
    return false;
  } else {
    hideValidationMessage(document.getElementById("dirPath"));
  }
  dirPathInput.addEventListener("focus", () =>
    hideValidationMessage(dirPathInput)
  );

  return true;
}

// show the success message
function showMessage(message, isSuccess) {
  const messageBox = document.getElementById("messageBox");
  const messageText = document.getElementById("messageText");

  messageText.textContent = message;

  if (isSuccess) {
    messageBox.classList.remove("error");
    messageBox.classList.add("success");
  } else {
    messageBox.classList.remove("success");
    messageBox.classList.add("error");
  }

  // Display the message box
  messageBox.style.display = "block";

  // Hide the message box after a few seconds
  setTimeout(function () {
    messageBox.style.display = "none";
  }, 7000);
}



// Create a rate limiter with a limit of 5 emails per second
const limiter = new Bottleneck({ maxConcurrent: 5, minTime: 200 });
let mailCount = 0;

// Function to send files as email attachments
async function sendFiles(event) {
  // Validate form before sending
  if (!formValidation()) {
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: mail_ID,
      pass: password,
    },
  });

  const formElement = document.getElementById("formbox1");
  const loadingElement = document.getElementById("loading");
  const mailCountBox = document.getElementById("mailCount");
  const mailCountNo = document.getElementById("mailCountNo");

  loadingElement.style.display = "block";
  mailCountBox.style.display = "block";
  formElement.classList.add("blur");

  // Set up paths
  const baseDir = __dirname;
  const excelPath = path.join(baseDir, "Form_16_test_list.xlsx");
  const dirPath = path.join(baseDir, "Files/"); // Folder where PDFs are stored
  if (!fs.existsSync(dirPath)) {
    showMessage("❌ 'Files' directory not found. Please create it and add your PDFs.", false);
    loadingElement.style.display = "none";
    formElement.classList.remove("blur");
    return;
  }

  // Read the Excel file
  const workbook = XLSX.readFile(excelPath);
  const sheet_name_list = workbook.SheetNames;
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

  // Filter data to only include rows with MAIL ID
  const filteredData = data.filter((obj) => obj.hasOwnProperty("MAIL ID"));

  if (filteredData.length === 0) {
    showMessage("❌ Invalid Excel format. No valid 'MAIL ID' column found.", false);
    loadingElement.style.display = "none";
    formElement.classList.remove("blur");
    return;
  }

  // Determine how many CODE columns exist
  let maxCodeFileNo = 0;
  filteredData.forEach((obj) => {
    Object.keys(obj).forEach((key) => {
      if (key.startsWith("CODE")) {
        const codeFileNo = parseInt(key.substring(4));
        if (codeFileNo > maxCodeFileNo) {
          maxCodeFileNo = codeFileNo;
        }
      }
    });
  });

  try {
    await Promise.all(
      filteredData.map(async (item) => {
        const zip = new AdmZip();
         console.log("📄 Excel row:", item);

        for (let i = 1; i <= maxCodeFileNo; i++) {
          const codeValue = item[`CODE${i}`];
          const empName = item["Employee Name"];
          const email = item["MAIL ID"];

          if (!codeValue || codeValue.trim() === "") {
            console.log(`⚠️ Skipping: No CODE${i} found [Recipient: ${email}]`);
            continue;
          }

          const pdfPath = path.join(dirPath, `${codeValue}.pdf`);
          if (!fs.existsSync(pdfPath)) {
            console.log(`❌ FAILED: No file found for ${codeValue}. Skipping... [Recipient: ${email}]`);
            continue;
          }

          zip.addLocalFile(pdfPath);
        }

        // Create ZIP name
        const downloadName = `${item["Employee Name"]}.zip`;
        const zipPath = path.join(dirPath, downloadName);
        zip.writeZip(zipPath);

        // Mail configuration
        const mailOptions = {
          from: mail_ID,
          to: item["MAIL ID"],
          subject: "Form 16 Documents",
          text: `Hi ${item["Employee Name"]},\n\nPlease find attached your Form 16 documents.\n\nBest regards,\nYour HR Team`,
          attachments: [
            {
              filename: downloadName,
              path: zipPath,
            },
          ],
        };

        // Send email with rate limiter
        try {
          await limiter.schedule(() => {
            return new Promise((resolve, reject) => {
              transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  console.log("❌ Email failed:", error.message);
                  showMessage(`❌ Failed to send to ${item["MAIL ID"]}`, false);
                  reject(error);
                } else {
                  console.log(`✅ Email sent successfully to ${item["MAIL ID"]}`);
                  mailCount++;
                  mailCountNo.textContent = mailCount;
                  resolve(info);
                }
              });
            });
          });
        } catch (error) {
          console.error("Email sending failed!", error);
        } finally {
          // Delete the ZIP after sending
          if (fs.existsSync(zipPath)) {
            fs.unlink(zipPath, (err) => {
              if (err) console.error("Error deleting zip file:", err);
            });
          }
        }
      })
    );

    mailCountBox.style.display = "none";
    showMessage(`✅ All Emails Sent Successfully: [${mailCount}]`, true);
    mailCount = 0;
  } catch (error) {
    showMessage(`❌ Error occurred: ${error}`, false);
  } finally {
    loadingElement.style.display = "none";
    formElement.classList.remove("blur");
    mailCountNo.textContent = 0;
    document.getElementById("formbox1").reset();
  }
}
