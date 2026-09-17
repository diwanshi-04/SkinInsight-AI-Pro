function runAnalysis() {
  const input = document.getElementById("imageInput");
  const consent = document.getElementById("consent").checked;
  const output = document.getElementById("analysisResult");

  if (!input.files.length) {
    alert("Please upload an image.");
    return;
  }
  if (!consent) {
    alert("Please give consent.");
    return;
  }

  // placeholder result — backend AI integration later
  output.innerHTML = "<p><strong>Analysis Result:</strong> Skin Type: Normal | Concerns: Mild Acne</p>";
}
