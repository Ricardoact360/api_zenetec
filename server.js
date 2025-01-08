import express from 'express';
import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;

// NOTE: Auth / API Key
const API_KEY = process.env.API_KEY;
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['api-key'];
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }
  next();
};

app.use(authenticateApiKey);
app.use(express.json());

app.get('/hello', (_req, res) => res.send('Hello World!'));

// NOTE: Create user and employee
app.post('/mso-create-user-employee', async (req, res) => {
  const { user, employee } = req.body;
  
  const requiredUserFields = [
    "title",
    "first_name",
    "last_name",
    "email",
    "password",
    "main_bodyshop",
    "custom_role"
  ];

  const requiredEmployeeFields = [
    "employee_id",
    "first_name",
    "last_name",
    "email",
    "position",
    "password",
    "main_bodyshop"
  ];

  function getValueByText(searchText) {
    const data = {
        'ops manager': '13f2f0a7-10ea-11ea-b358-ac1f6b40676a',
        'technician veterans': 'd4d17644-4fe1-46c4-bf0f-07186eb747e9',
        'intel manager': '3d5ebe4d-1960-489e-8433-8adc1a2cc30d',
        'production co-ordinator': '13f2f165-10ea-11ea-b358-ac1f6b40676a',
        'car wash co-ordinator': '881b7057-bef6-4333-9425-29df4aa6b282',
        'parts': '56118e93-05d4-11ea-af30-ac1f6b40676a',
        'glass/cal technician': '13f2f4c6-10ea-11ea-b358-ac1f6b40676a',
        'tv': '56115083-05d4-11ea-af30-ac1f6b40676a',
        'temp': '8231c3ef-f954-43f8-998a-de801c158b62',
        'act360 support': '13f2ed99-10ea-11ea-b358-ac1f6b40676a',
        'collision coop': '338215f9-695f-42c7-98ff-c4dbf411532b',
        'finishmaster audits': '053c1aa7-3155-4faf-bd81-210b21fd6f57',
        'ee inactive - inactive user': '919180ae-378f-47b1-9cae-f5beb9944627',
        'bodyshop manager': '56116888-05d4-11ea-af30-ac1f6b40676a',
        'appraiser role': '13f2edfb-10ea-11ea-b358-ac1f6b40676a',
        'customer service b': '485c0c58-9ffa-43d5-8ef6-2f9b2b86f652',
        'techconnect user': '56116956-05d4-11ea-af30-ac1f6b40676a',
        'accounting dept': '7a103216-f49f-11e9-a723-ac1f6b40676a',
        'payroll admin': '9bfcd919-3382-4e0c-8c83-1b39ea2cf9e4',
        'csr/closing': '13f2eeb8-10ea-11ea-b358-ac1f6b40676a',
        'estimator': '56118ecc-05d4-11ea-af30-ac1f6b40676a',
        'accounting dept': '561168bc-05d4-11ea-af30-ac1f6b40676a',
        'technician tiffin': '13f2f635-10ea-11ea-b358-ac1f6b40676a',
        'hr admin': 'ef841be5-d29a-43b7-8c0f-a09d44972c1a',
        'customer service': '56119960-05d4-11ea-af30-ac1f6b40676a',
    };

    return data[searchText.toLowerCase()] || null;
  }

  // NOTE: Validations
  const validateFields = (obj, requiredFields, objName) => {
    const missingFields = requiredFields.filter(field => !obj[field]);
    if (missingFields.length > 0) {
      return `${objName} is missing the following fields: ${missingFields.join(', ')}`;
    }
    return null;
  };

  // NOTE employee.password validation
  const validateEmployeePassword = (password) => {
    const numberOnlyRegex = /^\d+$/;
    if (!numberOnlyRegex.test(password)) {
      return "Employee password must contain only numbers";
    }
    return null;
  };

  // NOTE: Object validation
  const userValidationError = validateFields(user, requiredUserFields, "User");
  const employeeValidationError = validateFields(employee, requiredEmployeeFields, "Employee");
  const employeePasswordError = validateEmployeePassword(employee.password);

  if (userValidationError || employeeValidationError || employeePasswordError) {
    return res.status(400).json({
      success: false,
      errors: [
        ...(userValidationError ? [userValidationError] : []),
        ...(employeeValidationError ? [employeeValidationError] : []),
        ...(employeePasswordError ? [employeePasswordError] : []),
      ],
    });
  }
  try {
    const url = 'https://zenetec.bodyshopconnect.com/login'
    const storeUrl = 'https://zenetec.bodyshopconnect.com/site/chbodyshop?id=02bdab98-10ea-11ea-b358-ac1f6b40676a&type=mso'
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ httpCredentials: { username: '', password: '' } });
    const page = await context.newPage();

    // =================================================================
    // ============================ Login ==============================
    // =================================================================
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.getByPlaceholder('User Email').fill(process.env.EMAIL_USER);
    await page.getByPlaceholder('Password').fill(process.env.PASSWORD_USER);
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForTimeout(10000);

    await page.locator('li').filter({ hasText: 'ABR Zenetec MSOIntelAuto' }).getByRole('link').nth(1).click();
    await page.getByRole('link', { name: 'Zenetec MSO' }).click();

    const textMSOSuccessfullyChanged = await page.locator('body').textContent();
    if (!textMSOSuccessfullyChanged.includes('MSO successfully changed')) {
      throw new Error('Was not able to MSO successfully changed');
    }
    // =================================================================
    // ========================= User Creation =========================
    // =================================================================
    await page.waitForTimeout(5000);

    await page.getByText('User Management List of Users').click();
    await page.getByRole('link', { name: ' List of Users' }).click();

    await page.waitForTimeout(5000);

    await page.getByRole('link', { name: '+ Create' }).click();

    await page.waitForTimeout(5000);

    await page.getByLabel('Title').fill(user.title);
    await page.getByLabel('First Name').fill(user.first_name);
    await page.getByLabel('Last Name').fill((user.last_name));
    await page.getByRole('textbox', { name: 'Email *' }).fill(user.email);  // Step 13
    await page.getByLabel('App Username').fill((user.email)); // Step 14
    await page.getByLabel('New Password').fill(user.password);
    await page.getByLabel('Password Repeat').fill(user.password);
    await page.getByLabel('Role', { exact: true }).selectOption('owner'); // It's Fixed, don't move (Step 18)

    await page.getByLabel('Search').click();
    await page.getByLabel('Search').fill(user.main_bodyshop); // TODO: Variable + Enter (Step 20)
    await page.waitForTimeout(1000);
    await page.getByLabel('Search').press('Enter');

    await page.waitForTimeout(9500); // NOTE: Important wait for this
    await page.getByLabel('Custom Role').selectOption(getValueByText(user.custom_role)); // TODO: Variable!!!
    await page.waitForTimeout(5000);

    // NOTE: Create!
    await page.getByRole('button', { name: ' Create' }).click();
    await page.waitForTimeout(8000);

    /* await expect(page.locator('body')).toContainText('×CloseUser was created successfully.'); */
    const textUserCreated = await page.locator('body').textContent();
    if (!textUserCreated.includes('×CloseUser was created successfully.')) {
      throw new Error('User was not created, please check out your inputs/json');
    }
    console.info('User was created successfully')


    // =================================================================
    // ======================= Employee Creation =======================
    // =================================================================
    await page.waitForTimeout(12000);
    // await page.getByText('Bodyshop Admin APP Media Log').click();
    // await page.getByRole('link', { name: ' Employees' }).click();
    // await page.getByRole('link', { name: '+ Create' }).click();

    // Or just 
    await page.goto('https://zenetec.bodyshopconnect.com/employee/default/create', { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    await page.getByLabel('Code', { exact: true }).fill(employee.employee_id);
    await page.getByLabel('First Name').fill(employee.first_name);
    await page.getByLabel('Last Name').fill(employee.last_name);
    await page.getByLabel('Email').fill(employee.email);

    // NOTE: Be aware
    await page.getByPlaceholder('Select Position').click();
    await page.getByPlaceholder('Select Position').fill(employee.position); // NOTE: Important variable!
    await page.getByPlaceholder('Select Position').press('Enter');

    await page.getByLabel('Pay Type').selectOption('2');

    await page.getByLabel('Password', { exact: true }).fill(employee.password); // Must be numbers
    await page.getByLabel('Repeat Password').fill(employee.password);  // Must be numbers

    await page.getByRole('textbox', { name: 'Select Main Bodyshop' }).click();
    await page.locator('input[type="search"]').fill(employee.main_bodyshop);
    await page.locator('input[type="search"]').press('Enter');

    await page.getByPlaceholder('Select Bodyshops').click();
    await page.waitForTimeout(1500);
    await page.getByText('Select all', { exact: true }).click(); // Step (37 / 38)

    // NOTE: Create!
    await page.getByRole('button', { name: ' Create' }).click();

    await page.waitForTimeout(8000);
    /* await expect(page.locator('body')).toContainText('×CloseEmployee successfully created.'); */
    const textEmployeeCreated = await page.locator('body').textContent();
    if (!textEmployeeCreated.includes('×CloseEmployee successfully created.')) {
      throw new Error('User was not created, please check out your inputs/json');
    }

    // NOTE: Close browser!
    await browser.close();

    res.json({ 
      success: true, 
      message: `User and Employee created successfully`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Error in create user or employee. Please check logs' });
  }
});

// Listen ~
app.listen(port, () => console.log(`App listening on port ${port}!`));
