import wixPay from 'wix-pay';
import wixData from 'wix-data';
import { createMyPayment, sendCustomEmail, myCreateContactFunction } from "backend/pay.web"

$w.onReady(function () {
    // Initialize checkout state: 0 = Step1, 1 = Step2, 2 = Step3, 3 = Step4.
    let checkoutState = 0;

    // Reference UI elements for steps.
    let step1 = $w('#step1');
    let step2 = $w('#step2');
    let step3 = $w('#step3');
    let step4 = $w('#step4'); // Payment options step
    let prev = $w('#button15'); // Previous button
    let next = $w('#button14'); // Next button
    let payButton = $w('#button16');

    // Reference inputs:
    let tours = $w('#radioGroup1'); // Step 1: Tour date selection
    let singleRoomsInput = $w('#dropdown1'); // Step 2: Single rooms input
    let doubleRoomsInput = $w('#dropdown2'); // Step 2: Double rooms input
    let thaiMessage = $w('#dropdown4'); // Step 3: Add-on checkbox
    let namingCeremony = $w('#dropdown3'); // Step 3: Add-on checkbox
    let paymentOptions = $w('#radioGroup2'); // Step 4: Payment option radio group
    let breakdown = $w('#text93');
    let installments = $w('#box208');
    installments.hide();
    let paymentBreakdown = $w('#text93');
    let paymentBreakdownTitle = $w('#text94');
    let tourStart;
    let finalTotal = 0;
    // Textarea to display the running total.
    let totalTextArea = $w('#text95');

    // Global state to hold form values.
    let formState = {
        tourDate: "",
        singleRooms: 0,
        doubleRooms: 0,
        thaiMessage: 0,
        namingCeremony: 0,
        paymentOption: "full",
        totalCost: 0, // Full cost of the tour
        firstInstallment: 0 // If installments, the monthly or first payment
    };

    let totals = {
        single: 0,
        double: 0,
        thaiMassage: 0,
        namingCeremony: 0
    };

    // Pricing details.
    const singleRoomPrice = 2699;
    const doubleRoomPrice = 2499 * 2;
    const thaiMessagePrice = 65;
    const namingCeremonyPrice = 60;

    // 1) Update total cost
    function updateTotal() {
        let total = Object.values(totals).reduce((sum, val) => sum + val, 0);
        formState.totalCost = total;
        $w('#text95').text = `Total: £${total}`;
        console.log("Full Cost Updated:", total);
    }

    // Get number of months between today and start date
    function getMonthsBetween(startDate) {
        let today = new Date();
        let start = new Date(startDate);
        let yearsDiff = start.getFullYear() - today.getFullYear();
        let monthsDiff = start.getMonth() - today.getMonth();
        let totalMonths = yearsDiff * 12 + monthsDiff;
        return Math.max(totalMonths, 0); // Ensure non-negative months
    }

  // Generate installment payment schedule (one per month, ending month before tour start)
async function generatePaymentSchedule(totalCost, startDate) {
    const today = new Date();
    const start = new Date(startDate);

    // Month before tour start
    let endMonth = start.getMonth() - 1;
    let endYear = start.getFullYear();
    if (endMonth < 0) {
        endMonth += 12;
        endYear -= 1;
    }

    const installments = [];
    let current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Loop to generate installment dates until the month before tour
    while (
        current.getFullYear() < endYear ||
        (current.getFullYear() === endYear && current.getMonth() <= endMonth)
    ) {
        installments.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }

    if (installments.length === 0) {
        return [`Full payment of £${totalCost.toFixed(2)} required before ${formatDate(start)}`];
    }

    const monthlyInstallment = (totalCost / installments.length).toFixed(2);

    return installments.map(date => `£${monthlyInstallment} due by ${formatDate(date)}`);
}

// Helper function: format date as Day-Month-Year
function formatDate(date) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Calculate installment options dynamically
async function calculateInstallments(totalCost, startDate) {
    const today = new Date();
    const start = new Date(startDate);

    // Calculate number of valid installment months
    let endMonth = start.getMonth() - 1;
    let endYear = start.getFullYear();
    if (endMonth < 0) {
        endMonth += 12;
        endYear -= 1;
    }

    const firstInstallmentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let months = 0;
    let temp = new Date(firstInstallmentDate);
    while (
        temp.getFullYear() < endYear ||
        (temp.getFullYear() === endYear && temp.getMonth() <= endMonth)
    ) {
        months++;
        temp.setMonth(temp.getMonth() + 1);
    }

    const monthlyInstallment = months > 0 ? (totalCost / months).toFixed(2) : totalCost;
    const paymentSchedule = await generatePaymentSchedule(totalCost, startDate);

    // Populate the payment options
    const options = [{ label: `Pay now in full (£${totalCost})`, value: "full" }];
    if (months > 0) {
        options.push({
            label: `Pay £${monthlyInstallment} per month for ${months} months`,
            value: "installments"
        });
    }

    paymentOptions.options = options;
    console.log("Payment Schedule:", paymentSchedule);
    return paymentSchedule;
}


    $w("#dataset1").setFilter(
            wixData.filter().ne("title", "RESET_ALL") // Exclude items where title = RESET_ALL
        )
        .then(() => {
            return $w("#dataset1").getItems(0, 100);
        })
        .then((result) => {
            console.log("result", result);

            // Sort by tourStart (oldest to newest)
            let sortedOptions = result.items.sort((a, b) => {
                let dateA = new Date(a.tourStart);
                let dateB = new Date(b.tourStart);
                return dateA - dateB; // Ascending order (oldest first)
            }).map(item => {
                // Format dates in UK format: DD-MM-YYYY
                const formatUKDate = (dateStr) => {
                    const date = new Date(dateStr);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                };

                const startFormatted = formatUKDate(item.tourStart);
                const endFormatted = formatUKDate(item.tourEnd);

                return {
                    label: `${item.title} (${startFormatted} - ${endFormatted})`,
                    value: item._id
                };
            });

            // Assign formatted options to the radio group
            $w("#radioGroup1").options = sortedOptions;
            console.log("Updated radio group options:", sortedOptions);
        })
        .catch((err) => {
            console.error("Filter error:", err);
        });

    // ----------------------------
    // onChange event handlers:
    // ----------------------------

    // Step 1: Tour date selection.
    tours.onChange(async (event) => {
        let selected = event.target.value
        console.log('selected: ', selected);

        //get actual start date 
        await wixData.query("TourDates")
            .eq("_id", selected)
            .find()
            .then((results) => {
                if (results.items.length > 0) {
                    tourStart = results.items[0].tourStart;
                    console.log(tourStart);

                }
            })
            .catch((err) => {
                console.error("Error querying collection:", err);
            });
    });

    // Step 2: Room selections.
    singleRoomsInput.onChange((event) => {
        formState.singleRooms = Number(event.target.value);
        totals.single = formState.singleRooms * singleRoomPrice;
        updateTotal();
        $w('#text98').text = `${formState.singleRooms} x £${singleRoomPrice}.....................£${formState.singleRooms*singleRoomPrice}`;

    });

    doubleRoomsInput.onChange((event) => {
        formState.doubleRooms = Number(event.target.value);
        totals.double = formState.doubleRooms * doubleRoomPrice;
        updateTotal();
        $w('#text97').text = `${formState.doubleRooms} x £${doubleRoomPrice}.....................£${formState.doubleRooms*doubleRoomPrice}`;
    });

    // Step 3: Add-on checkboxes.
    thaiMessage.onChange((event) => {
        formState.thaiMessage = Number(event.target.value);
        totals.thaiMassage = formState.thaiMessage * thaiMessagePrice;
        updateTotal();
        $w('#text99').text = `${Number(formState.thaiMessage)} x £${thaiMessagePrice}.....................£${Number(formState.thaiMessage)*thaiMessagePrice}`;
    });

    namingCeremony.onChange(async (event) => {
        formState.namingCeremony = Number(event.target.value);
        totals.namingCeremony = formState.namingCeremony * namingCeremonyPrice;
        updateTotal();
        $w('#text100').text = `${formState.namingCeremony} x £${namingCeremonyPrice}.....................£${formState.namingCeremony*namingCeremonyPrice}`;
        await installment();
    });

    async function installment() {
        // Use the full cost for the schedule
        const paymentSchedule = await calculateInstallments(formState.totalCost, tourStart);

        if (Array.isArray(paymentSchedule) && paymentSchedule.length > 0) {
            breakdown.text = paymentSchedule.join("\n");

            // If "Full payment required", there's no monthly breakdown
            if (paymentSchedule[0] === "Full payment required") {
                formState.firstInstallment = formState.totalCost;
                console.log("Only full payment is required, firstInstallment set to:", formState.firstInstallment);
            } else {
                // Extract the first monthly installment from the schedule
                const match = paymentSchedule[0].match(/£([\d.]+)/);
                formState.firstInstallment = match ? parseFloat(match[1]) : formState.totalCost;
                console.log("First Installment Updated:", formState.firstInstallment);
            }
        }
    }

    // Step 4: Payment option selection.
    paymentOptions.onChange(async (event) => {
        formState.paymentOption = event.target.value;

        if (formState.paymentOption !== "full") {
            installments.show();
            // Payment is the first monthly installment
            finalTotal = formState.firstInstallment;
        } else {
            installments.hide();
            // Payment is the full cost
            finalTotal = formState.totalCost;
        }
        console.log("finalTotal (current checkout amount):", finalTotal);
    });

    // ----------------------------
    // Multi-step navigation functions:
    // ----------------------------

    function validateStep(currentStep) {
        switch (currentStep) {
        case 1:
            return validateTourSelection();
        case 2:
            return validateBedSelection();
        case 3:
            return validateAddOnsSelection();
        case 4:
            return validatePaymentSelection();
        default:
            return true;
        }
    }

    // Validation for each step
    function validateTourSelection() {
        let selectedTour = tours.value;
        if (!selectedTour) {
            showError("Please select a tour date before proceeding.");
            return false;
        }
        return true;
    }

    function validateBedSelection() {
        let selectedBed = singleRoomsInput.value;
        let doubleBed = doubleRoomsInput.value;
        if (!selectedBed || !doubleBed) {
            showError("Please select a bed option before proceeding.");
            return false;
        }
        return true;
    }

    function validateAddOnsSelection() {
        let selectedThaiMassage = thaiMessage.value;
        let selectedNamingCeremony = namingCeremony.value
        if (!selectedNamingCeremony || !selectedThaiMassage) {
            showError("Please select a add on options before proceeding.");
            return false;
        }
        return true;
    }

    function validatePaymentSelection() {
        let selectedPayment = paymentOptions.value;
        if (!selectedPayment) {
            showError("Please select a payment option before proceeding.");
            return false;
        }
        return true;
    }

    // Display error message
    function showError(message) {
        //show user what info is missing
        $w("#error").text = message;
        $w("#error").show();
        return;
    }

    function updateSteps() {
        switch (checkoutState) {
        case 0:

            step1.show("fade", { duration: 300 });
            step2.hide("fade", { duration: 300 });
            step3.hide("fade", { duration: 300 });
            step4.hide("fade", { duration: 300 });
            prev.hide("fade", { duration: 300 });
            next.show("fade", { duration: 300 });
            break;
        case 1:

            updateTotal();
            step1.hide("fade", { duration: 300 });
            step2.show("fade", { duration: 300 });
            step3.hide("fade", { duration: 300 });
            step4.hide("fade", { duration: 300 });
            prev.show("fade", { duration: 300 });
            next.show("fade", { duration: 300 });
            break;
        case 2:

            updateTotal();
            installment();

            step1.hide("fade", { duration: 300 });
            step2.hide("fade", { duration: 300 });
            step3.show("fade", { duration: 300 });
            step4.hide("fade", { duration: 300 });
            prev.show("fade", { duration: 300 });
            next.show("fade", { duration: 300 });
            break;
        case 3:

            updateTotal();
            installment();

            step1.hide("fade", { duration: 300 });
            step2.hide("fade", { duration: 300 });
            step3.hide("fade", { duration: 300 });
            step4.show("fade", { duration: 300 });
            prev.show("fade", { duration: 300 });
            next.hide("fade", { duration: 300 });
            break;
        default:
            break;
        }
    }

    // Initialize the view.
    updateSteps();
    updateTotal(); // Initialize total and payment options

    // Navigation: Next and Previous button handlers.
    next.onClick(() => {
        if (checkoutState < 3) {
            checkoutState++;
            updateSteps();
        }
    });

    prev.onClick(() => {
        if (checkoutState > 0) {
            checkoutState--;
            updateSteps();
        }
    });

    payButton.onClick(() => {
        console.log('click');
    });

    payButton.onClick(async () => {
        let paymentRequest = {
            name: "Tour Reservation",
            price: finalTotal, // Ensure this has a valid value
        };

        try {
            // Create the payment via the backend. Pass the object directly!
            const paymentObj = await createMyPayment(paymentRequest);
            console.log("Payment object created in backend:", paymentObj);

            // Start the payment flow using the valid payment.id from the backend
            const paymentResult = await wixPay.startPayment(paymentObj.id);
            console.log("Payment result:", paymentResult);

            if (paymentResult.status === "Successful") {
                // Payment successful - now save the reservation record to your CMS collection.
                let reservationRecord = {
                    tourDate: formState.tourDate,
                    singles: formState.singleRooms,
                    doubles: formState.doubleRooms,
                    massages: formState.thaiMessage,
                    namingCeremony: formState.namingCeremony,
                    totalCost: finalTotal,
                    paymentOption: formState.paymentOption,
                    paymentId: paymentResult.payment.id,
                    paymentStatus: paymentResult.status,
                    name: paymentResult.userInfo.firstName,
                    email: paymentResult.userInfo.email,
                    createdDate: new Date()
                };

                // Insert the record into the "Reservations" collection
                let insertResult = await wixData.insert("TourReservations", reservationRecord);
                console.log("Reservation saved:", insertResult);

                const emailId = "UfzBWa6";
                const contactId = await myCreateContactFunction(paymentResult.userInfo.firstName, paymentResult.userInfo.email);

                // Define the variables for the email template
                const variables = {
                    name: paymentResult.userInfo.firstName,
                    email: paymentResult.userInfo.email,
                    tourDate: formState.tourDate,
                    singles: formState.singleRooms,
                    doubles: formState.doubleRooms,
                    massages: formState.thaiMessage,
                    namingCeremony: formState.namingCeremony,
                };

                // Call the backend function
                await sendCustomEmail(emailId, contactId, variables)
                    .then(response => {
                        if (response.success) {
                            console.log("✅ Email sent:", response.message);
                        } else {
                            console.error("❌ Email failed:", response.error);
                        }
                    })
                    .catch(error => {
                        console.error("❌ Error:", error);
                    });
            } else {
                console.error("Payment was not successful:", paymentResult);
            }
        } catch (error) {
            console.error("Error during payment process:", error);
        }
    });

});