// Validates the Raise Ticket form against real master data (categoryObj comes from
// HRMasterDataResponse.Categories — IsBespoke/HasSubCategory flags replace the old
// BESPOKE_CATS/NO_SUBCATEGORY_CATS mock arrays). categoryDetails holds whichever bespoke-category
// fields are relevant (see ServiceDeskPage's emptyCategoryDetails for the full shape).
export function validateNewTicketForm(categoryObj, form, categoryDetails) {
  const errors = {};
  if (!categoryObj) { errors.category = "Please select a category"; return errors; }

  if (!form.description || form.description.trim().length < 3) {
    errors.description = "Please enter a description (at least 3 characters)";
  }

  if (!categoryObj.isBespoke) {
    if (categoryObj.hasSubCategory && !form.subCategoryId) {
      errors.subCategory = "Please select a sub category";
    }
    return errors;
  }

  switch (categoryObj.categoryName) {
    case "Visitor Lunch":
      if (!categoryDetails.lunchFromDate) errors.lunchFromDate = "Please select a from date";
      if (!categoryDetails.lunchToDate) errors.lunchToDate = "Please select a to date";
      if (!categoryDetails.lunchType) errors.lunchType = "Please select a lunch request type";
      if (!categoryDetails.lunchCount || Number(categoryDetails.lunchCount) < 1) errors.lunchCount = "Please enter a valid count";
      break;
    case "Repair and Maintenance":
      if (!categoryDetails.repairItemId) errors.repairItemId = "Please select a repair item";
      if (!categoryDetails.repairCount || Number(categoryDetails.repairCount) < 1) errors.repairCount = "Please enter a valid count";
      if (!categoryDetails.repairFloorId) errors.repairFloorId = "Please select a floor";
      break;
    case "Access Request/ID Card":
      if (!categoryDetails.idCardBloodGroupId) errors.idCardBloodGroupId = "Please select a blood group";
      if (!categoryDetails.idCardImageFile && !categoryDetails.idCardImagePath) {
        errors.idCardImage = "Please upload an image (jpg, max 512 KB)";
      }
      break;
    case "Stationery":
      if (!categoryDetails.stationaryCategoryId) errors.stationaryCategoryId = "Please select a stationary category";
      else if (!categoryDetails.stationarySubCategoryId) errors.stationarySubCategoryId = "Please select a stationary item";
      else if (!categoryDetails.stationaryItemDescriptionId) errors.stationaryItemDescriptionId = "Please select an item description";
      else if (!categoryDetails.stationaryItemQtyId) errors.stationaryItemQtyId = "Please select a quantity/unit";
      if (!categoryDetails.stationaryFloorId) errors.stationaryFloorId = "Please select a floor";
      break;
    default:
      break;
  }

  return errors;
}
