# Admin Pages Translation Audit

Complete list of all English text requiring Chinese translations across admin pages.

## 1. admin.html

### Header & Navigation
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Admin | button label | Header - admin dropdown button |
| ▼ | dropdown arrow | Header - admin dropdown arrow |
| Logout | dropdown item | Admin dropdown menu |
| 🚪 Logout | menu item | Admin dropdown with emoji |
| Edit | button label | Header - table edit button |
| Edit | button label | Header - menu edit button |
| Edit | button label | Header - staff edit button |
| ∿ Reports | button label | Header - reports button |
| History | button label | Header - orders history button |

### Sidebar Navigation
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Orders | menu item | Sidebar - orders navigation |
| Tables | menu item | Sidebar - tables navigation |
| Menu | menu item | Sidebar - menu navigation |
| Staff | menu item | Sidebar - staff navigation |
| Bookings | menu item | Sidebar - bookings navigation |
| Reports | menu item | Sidebar - reports navigation |
| More | menu item | Sidebar - settings/more navigation |
| chuio.io | trademark | Sidebar footer |

### Staff Form (Sliding Panel)
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Create New Staff | form title | Staff form panel header |
| Staff Name | form label | Staff form - name field |
| e.g., John Smith | placeholder text | Staff form - name input placeholder |
| PIN (6 digits) | form label | Staff form - PIN field |
| e.g., 123456 | placeholder text | Staff form - PIN input placeholder |
| Role | form label | Staff form - role dropdown |
| -- Select Role -- | dropdown option | Staff form - role dropdown default |
| Staff | dropdown option | Staff form - role Staff option |
| Kitchen | dropdown option | Staff form - role Kitchen option |
| Tab Access Permissions | section header | Staff form - access rights for staff |
| Orders | checkbox label | Staff form - access rights Orders |
| Tables | checkbox label | Staff form - access rights Tables |
| Menu | checkbox label | Staff form - access rights Menu |
| Staff | checkbox label | Staff form - access rights Staff |
| Settings | checkbox label | Staff form - access rights Settings |
| Food Categories Access | section header | Staff form - access rights for kitchen |
| ➕ Add Staff | button label | Staff form - submit button |
| Cancel | button label | Staff form - cancel button |

## 2. admin-staff.html

### Create/Edit Staff Section
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Create/Edit Staff | section title | Staff create/edit form header |
| Staff Name | form label | Staff create form - name field |
| e.g., John Smith | placeholder text | Staff create form - name input |
| PIN (6 digits) | form label | Staff create form - PIN field |
| e.g., 123456 | placeholder text | Staff create form - PIN input |
| Role | form label | Staff create form - role field |
| Staff | select option | Staff create form - Staff role option |
| Kitchen | select option | Staff create form - Kitchen role option |
| Hourly Rate ($/hr) | form label | Staff create form - hourly rate field |
| e.g., 15.50 | placeholder text | Staff create form - hourly rate input |
| Tab Access Permissions | section title | Staff form - tab access header |
| Orders | checkbox label | Staff form - Orders access |
| Tables | checkbox label | Staff form - Tables access |
| Menu | checkbox label | Staff form - Menu access |
| Staff | checkbox label | Staff form - Staff access |
| Settings | checkbox label | Staff form - Settings access |
| Bookings | checkbox label | Staff form - Bookings access |
| Food Categories Access | section title | Staff form - kitchen categories header |
| ➕ Add Staff | button label | Staff form - add staff button |
| Cancel | button label | Staff form - cancel button |

### Staff Grid & Cards
| Original English Text | Element Type | Location/Context |
|---|---|---|
| No staff members yet | empty state | Staff grid - no data message |

### Staff Detail Modal
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Staff Name | modal title | Staff detail modal - staff name header |
| Role | label | Staff detail modal - role field label |
| — | placeholder | Staff detail modal - role placeholder |
| PIN | label | Staff detail modal - PIN field label |
| — | placeholder | Staff detail modal - PIN placeholder |
| Hourly Rate | label | Staff detail modal - hourly rate field label |
| — | placeholder | Staff detail modal - hourly rate placeholder |
| Status | label | Staff detail modal - status field label |
| — | placeholder | Staff detail modal - status placeholder |
| Clock In/Out | section title | Staff detail modal - clock in/out section |
| ▶ Clock In | button label | Staff detail modal - clock in button |
| ⏹ Clock Out | button label | Staff detail modal - clock out button |
| Work Hours (Last 30 Days) | section title | Staff detail modal - work hours summary |
| Days Worked | label | Staff detail modal - days worked field |
| Total Hours | label | Staff detail modal - total hours field |
| 0 | default value | Staff detail modal - days/hours default |
| Work Log (Last 30 Days) | section title | Staff detail modal - work log section |
| Loading... | loading text | Staff detail modal - timekeeping list loading |
| ✏️ Edit Staff | button label | Staff detail modal - edit button |
| 🗑️ Delete Staff | button label | Staff detail modal - delete button |
| 🟢 Clocked In | status text | Staff detail modal - clock in status |
| ⚪ Clocked Out | status text | Staff detail modal - clock out status |
| No work history in the last 30 days | empty state | Staff detail modal - no timekeeping records |
| Still working | text | Staff detail modal - clock out time not yet |

### Alert/Confirmation Messages (JavaScript)
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Delete this staff member? | confirmation dialog | Staff delete confirmation |
| Name and PIN are required | error message | Staff form validation |
| PIN must be exactly 6 digits | error message | Staff form validation |
| Hourly rate must be a positive number | error message | Staff form validation |
| Failed to delete staff | error message | Staff delete failure |
| Error: | error prefix | Error messages |
| Network error: | error prefix | Network errors |
| Operation failed | error text | Generic operation failure |
| Staff member created successfully | success message | Staff creation success |
| Staff member updated successfully | success message | Staff update success |
| Staff member deleted | success message | Staff deletion success |
| Error loading staff: | error prefix | Staff loading error |
| Error loading categories: | error prefix | Category loading error |
| Error loading staff details: | error message | Staff detail loading error |
| ✓ Clocked in successfully | success message | Clock in success |
| Error: | error prefix | Clock in error |
| Failed to clock in | error text | Clock in failure |
| ✓ Clocked out successfully | success message | Clock out success |
| Failed to clock out | error text | Clock out failure |

## 3. admin-tables.html

### Session Panel
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Select a session to view orders | instruction text | Session panel - initial state |
| 📖 View Full Orders | button label | Session panel - view orders button |
| 💰 Close Bill | button label | Session panel - close bill button |

### Orders Modal
| Original English Text | Element Type | Location/Context |
|---|---|---|
| 📋 All Orders | modal title | Orders modal - title |
| Total: — | label text | Orders modal - total line |
| Close | button label | Orders modal - close button |

### Table Categories
| Original English Text | Element Type | Location/Context |
|---|---|---|
| + Add | button label | Table category tabs - add category button |
| No categories available | empty state | Tables grid - no categories message |
| No tables in this category | empty state | Tables grid - no tables message |

### Table Cards
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Available | status text | Table card - available status |
| Dining | status text | Table card - dining status |
| Reserved | status text | Table card - reserved status |
| Rename | button label | Table card edit - rename button |
| Seats | button label | Table card edit - seats button |
| Delete | button label | Table card edit - delete button |

### Prompts & Dialogs
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Enter new table category name (e.g., Main Floor, Patio): | prompt text | Add category prompt |
| "" | default value | Category name prompt default |
| Failed to create category | error message | Category creation error |
| Error creating category: | error prefix | Category error |
| Enter table name (e.g., T01, Table 1): | prompt text | Add table prompt |
| "" | default value | Table name prompt default |
| Enter number of seats: | prompt text | Table seats prompt |
| Invalid seat count | error message | Table creation validation |
| Category name required | error message | Category validation |
| Enter new table name: | prompt text | Rename table prompt |
| Enter new seat count: | prompt text | Change seats prompt |
| Error: | error prefix | General errors |
| Error: Invalid staff ID | error message | Staff ID validation |
| Error updating seats: | error prefix | Seat update error |
| Failed to create table | error message | Table creation failure |
| Error creating table: | error prefix | Table creation error |
| Error: No category selected. Please select a category tab first. | error message | Category validation |
| Unknown error | error message | Generic error |

### Table Card Elements
| Original English Text | Element Type | Location/Context |
|---|---|---|
| + | button text | Add table card - plus icon |
| m | unit | Table card - minutes elapsed |
| h | unit | Table card - hours elapsed |
| Chair icon alt text | alt text | Seat count icon |

### Inline Message Strings (JavaScript Generated)
| Original English Text | Element Type | Location/Context |
|---|---|---|
| Now | reservation time | Table card - reservation time now |
| In X min(s) | reservation time | Table card - reservation time upcoming |
| In Xh Xm | reservation time | Table card - reservation time format |
| In Xh | reservation time | Table card - reservation time hours only |
| Failed to load staff | error message | Staff loading error |
| No access | access rights | Staff card - no access indicator |
| Access: | label | Staff card - access rights label |
| Edit Staff | button label (in modal function) | Staff detail modal edit |
| Delete this staff member? | confirmation | Staff deletion confirmation |

## 4. Common UI Elements Across All Admin Pages

### Status Indicators
| Original English Text | Element Type | Context |
|---|---|---|
| Active | status badge | Staff/tables status |
| Inactive | status badge | Staff/tables status |
| Pending | status badge | Generic status |
| Error | status badge | Error state |
| Success | status badge | Success state |

### Common Buttons
| Original English Text | Element Type | Context |
|---|---|---|
| Save | button | Generic save operations |
| Cancel | button | Generic cancellation |
| Edit | button | Generic edit operations |
| Delete | button | Generic delete operations |
| Create | button | Generic creation |
| Add | button | Generic addition |
| Remove | button | Generic removal |
| Update | button | Generic updates |
| Close | button | Generic close operations |
| Back | button | Navigate back |
| Confirm | button | Confirm actions |
| Done | button | Mark completion |

### Form Validation Messages
| Original English Text | Element Type | Context |
|---|---|---|
| Required field | validation error | Generic required field |
| Invalid format | validation error | Format validation |
| Already exists | validation error | Duplicate check |
| Please enter a valid value | validation error | Generic validation |

### Common Modal Elements
| Original English Text | Element Type | Context |
|---|---|---|
| Confirm | modal button | Confirmation dialogs |
| Cancel | modal button | Cancellation dialogs |
| Yes | modal button | Yes/no questions |
| No | modal button | Yes/no questions |

## 5. Dynamic Content (JavaScript-Generated Text)

### Error Messages
- "Failed to load [item]"
- "Error: [specific error]"
- "[Action] completed successfully"
- "[Action] failed"
- "Please [action required]"
- "Are you sure?" (confirmations)

### Status Messages
- "Loading..."
- "No data available"
- "Please wait..."
- "Operation in progress..."

### Time/Date Displays
- Relative time formats ("2 days ago", "Just now", etc.)
- Date formats (localized)
- Time formats (localized)

---

## Summary of Key Terms to Translate

### Roles
- Staff
- Kitchen
- Admin
- Superadmin

### Actions
- Create
- Edit
- Delete
- Save
- Cancel
- Update
- Add
- Remove
- Close
- Clock In
- Clock Out

### Sections
- Orders
- Tables
- Menu
- Staff
- Bookings
- Reports
- Settings/More

### Status Values
- Active
- Inactive
- Available
- Dining
- Reserved
- Clocked In
- Clocked Out

### Common Fields
- Name
- PIN
- Role
- Status
- Email
- Phone
- Password
- Rate/Hourly Rate
- Access Rights
- Permissions

---

## TOTAL COUNT: ~200+ distinct translatable strings

This audit includes:
- Button labels: ~50
- Form labels: ~40
- Headers/titles: ~30
- Error messages: ~35
- Status indicators: ~20
- Menu items: ~10
- Placeholder text: ~15
- Miscellaneous UI text: ~20+

