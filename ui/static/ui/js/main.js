var ew = {
	components: {},
	pages: {},
	tools: {},
	application: {
		components: {}
	}
};
ew.CustomEvent = (function(){

	function CustomEvent(){

		this.subscribers = [];
	}

	var proto = CustomEvent.prototype;

	proto.subscribe = function( fn ){

		this.subscribers.push( fn );
	};

	proto.unSubscribe = function( fn ){

		var i = 0;
		var l = this.subscribers.length;

		for( ; i < l; i++ ) {

			if( this.subscribers[ i ] === fn ){

				this.subscribers.pop( i, 1 );

				break;
			}
		}
	};

	proto.publish = function() {

		var i = this.subscribers.length-1;

		for( ; i >= 0; i-- ){

			try {

				this.subscribers[ i ].apply( this, arguments );

			} catch( e ){}
		}
	};

	return CustomEvent;
}());
ew.tools.toLocaleString = function localeString( number, separator, grouping ){

    separator = ( separator || ',' );
    grouping = ( grouping === 0 ? grouping : 3);

    var numberParts = ( '' + number ).split( '.' );
    var i = numberParts[0].length;
    var s = '';
    var j;

    while( i > grouping ){
        j = i - grouping;
        s = separator + numberParts[ 0 ].slice( j, i ) + s;
        i = j;
    }

    s = numberParts[ 0 ].slice( 0, i ) + s;
    numberParts[ 0 ] = s;
    
    return numberParts.join( '.' );
};
ew.components.AddContributors = (function( $ ){

	function errorMessage( field ){
		return ( field + ' is required for AddContributorsComponent' );
	}
	
	function AddContributorsComponent( opts ){

		if( !opts ){ throw new Error( errorMessage( 'opts' ) ); }
		if( !opts.contributorsSelector ){ throw new Error( errorMessage( 'opts.contributorsSelector' ) ); }
		if( !opts.nameInputSelector ){ throw new Error( errorMessage( 'opts.nameInputSelector' ) ); }

		var self = this;
		this.$contributors = $( opts.contributorsSelector );
		this.contributorsSelector = opts.contributorsSelector;
		this.nameInputSelector = opts.nameInputSelector;

		this.shownContributors = 0;
		this.contributorsLength = this.$contributors.length;

		this.createAddButton();
		this.hideContributingLines();
		this.showCloseButton();

		this.$contributors.on( 'click', '.remove-contributor', function( e ){

			self.removeContributor( e, this );
		} );
	}

	AddContributorsComponent.prototype.focusOnFirstNameInput = function(){
		
		var $nameInput = $( this.$contributors[ 0 ] ).find( this.nameInputSelector );

		if( !$nameInput.val() ){

			$nameInput.focus();
		}
	};

	AddContributorsComponent.prototype.showCloseButton = function(){
		
		var buttonHtml = '<button type="button" class="btn btn-xs btn-default remove-contributor" aria-label="Remove contributor" title="Remove contributor">Remove</button>';
		var $lastVisible = $( this.contributorsSelector + ':visible' ).last();

		if( !$lastVisible.is( this.$contributors[ 0 ] ) ){
		
			$lastVisible.prepend( buttonHtml );
		}
	};

	AddContributorsComponent.prototype.removeCloseButton = function(){
		
		$( this.contributorsSelector + ' .remove-contributor' ).remove();
	};

	AddContributorsComponent.prototype.updateCloseButton = function(){
	
		this.removeCloseButton();
		this.showCloseButton();
	};

	AddContributorsComponent.prototype.createAddButton = function(){
		
		this.$addButton = $( '<button class="btn btn-default">Add another contributor</button>' );
		this.$contributors.parent().append( this.$addButton );
		this.$addButton.on( 'click', $.proxy( this.addContributor, this ) );
	};

	AddContributorsComponent.prototype.hideContributingLines = function(){

		var self = this;

		self.$contributors.each( function( index ){

			var $contributor = $( this );
			var $nameInput;

			//always show the first group
			if( index === 0 ){

				$contributor.show();

			} else if( index > self.shownContributors ){

				//if the name has some content, then we need to show it (edit mode)
				$nameInput = $contributor.find( self.nameInputSelector );
				
				if( $nameInput.val().length > 0 ){

					$contributor.show();
					self.shownContributors++;

				} else {

					$contributor.hide();
				}

			} else {

				//otherwise hide the group
				$contributor.hide();
			}
		} );
	};

	AddContributorsComponent.prototype.addContributor = function( e ){

		var $currentContributor;

		e.preventDefault();

		if( this.shownContributors < this.contributorsLength ){

			this.shownContributors++;
			$currentContributor = $( this.$contributors[ this.shownContributors ] );
			$currentContributor.show();
			$currentContributor.find( this.nameInputSelector ).focus();
			this.updateCloseButton();

			this.checkAddButtonState();

		} else {

			alert( 'Sorry, the system can\'t add more than 5 contributing teams. Please choose teams that contributed the most.' );
		}
	};

	AddContributorsComponent.prototype.checkAddButtonState = function(){

		var isDisabled = ( this.shownContributors === ( this.contributorsLength - 1 ) );
		
		this.$addButton[ 0 ].disabled = isDisabled;
	};

	AddContributorsComponent.prototype.removeContributor = function( e, elem ){
		
		var $contributor = $( elem ).parent( this.contributorsSelector );

		$contributor.hide();
		$contributor.find( 'input' ).val( '' );
		$contributor.find( 'select' ).each( function(){

			this.selectedIndex = 0;
		} );

		this.shownContributors--;
		this.updateCloseButton();
		this.checkAddButtonState();
	};

	return AddContributorsComponent;

}( jQuery ));
ew.components.CalculateExportValue = (function( $, toLocaleString ){

	var zeros = /^0+$/;
	
	function errorMessage( field ){
		return ( field + ' is required for CalculateExportValueComponent' );
	}

	function CalculateExportValueComponent( opts ){

		if( !opts ){ throw new Error( errorMessage( 'opts' ) ); }
		if( !opts.values ){ throw new Error( errorMessage( 'opts.values' ) ); }
		if( !opts.total ){ throw new Error( errorMessage( 'opts.total' ) ); }

		this.values = opts.values;
		this.$total = $( '#' + opts.total );
		this.currency = '£';
		this.$values = [];

		this.updateHtml();
		this.getValueElems();
		this.setupListeners();
		this.updateValue();
	}

	CalculateExportValueComponent.prototype.updateHtml = function(){

		var totalYearsClass = 'export-total-years';
		var totalValueClass = 'export-total-value';
		var $formGroup = this.$total.parents( '.form-group' );
		
		this.$total[ 0 ].type = 'hidden';

		$formGroup.find( '.help-text' ).hide();
		$formGroup.find( 'label' ).hide();
		$formGroup.find( '.required' ).hide();
		
		this.$totalInfo = $( '<p class="export-total">Totaling over <span class="'+ totalYearsClass +'"></span>: <span class="'+ totalValueClass +'"</span></p>' );
		this.$totalYears = this.$totalInfo.find( '.' + totalYearsClass );
		this.$totalValue = this.$totalInfo.find( '.' + totalValueClass );

		$formGroup.prepend( this.$totalInfo );
	};

	CalculateExportValueComponent.prototype.getValueElems = function(){
		
		var ids = [];
		var i = 0;
		var id;

		while( ( id = this.values[ i++ ] ) ){

			id = ( '#' + id );
			this.$values.push( $( id ) );
		}
	};

	CalculateExportValueComponent.prototype.setupListeners = function(){
		
		var self = this;
		var i = 0;
		var $value;
		var proxiedUpdate = $.proxy( this.updateValue, this );

		function createHandlers( $elem ){

			$value.on( 'keyup', proxiedUpdate );

			$elem.on( 'focus', function(){
				self.handleFocus( $elem );
			} );

			$elem.on( 'blur', function(){
				self.handleBlur( $elem );
			} );
		}

		while( ( $value = this.$values[ i++] ) ){
			createHandlers( $value );
		}
	};

	CalculateExportValueComponent.prototype.handleBlur = function( $elem ){

		var val = $elem.val();

		if( val === '' || zeros.test( val ) ){

			$elem.val( 0 );
		}
	};

	CalculateExportValueComponent.prototype.handleFocus = function( $elem ){
		
		if( zeros.test( $elem.val() ) ){
			$elem.val( '' );
		}
	};

	CalculateExportValueComponent.prototype.updateValue = function(){
		
		var total = 0;
		var i = 0;
		var years = 0;
		var $value;

		while( ( $value = this.$values[ i++] ) ){

			yearTotal = Number( $value.val() );

			if( yearTotal > 0 ){

				total += yearTotal;
				years++;
			}
		}

		this.$totalYears.text( years + ( years === 1 ? ' year' : ' years' ) );
		this.$totalValue.text( this.currency + toLocaleString( total ) );
		this.$total.val( total );
	};

	return CalculateExportValueComponent;

}( jQuery, ew.tools.toLocaleString ));
ew.components.ToggleContributors = (function( $ ){

	function errorMessage( field ){
		return ( field + ' is required for ToggleContributorsComponent' );
	}
	
	function ToggleContributorsComponent( opts ){

		if( !opts ){ throw new Error( errorMessage( 'opts' ) ); }
		if( !opts.$contributingTeamDetails ){ throw new Error( errorMessage( 'opts.$contributingTeamDetails' ) ); }
		if( !opts.$someContributors ){ throw new Error( errorMessage( 'opts.$someContributors' ) ); }
		if( !opts.noContributorsSelector ){ throw new Error( errorMessage( 'opts.noContributorsSelector' ) ); }

		this.$contributingTeamDetails = opts.$contributingTeamDetails;
		this.$someContributors = opts.$someContributors;
		this.noContributorsSelector = opts.noContributorsSelector;

		this.events = {
			showDetails: new ew.CustomEvent()
		};

		this.checkContributingDetails();
		this.createListeners();
	}

	ToggleContributorsComponent.prototype.toggleContributingDetails = function( e ){

		if( this.$someContributors[ 0 ].checked ){

			this.$contributingTeamDetails.show();
			this.events.showDetails.publish();

		} else {

			this.$contributingTeamDetails.hide();
		}
	};

	ToggleContributorsComponent.prototype.createListeners = function(){
		
		var $noContributors = $( this.noContributorsSelector );
		var proxiedToggle = $.proxy( this.toggleContributingDetails, this );

		this.$someContributors.on( 'click', proxiedToggle );
		$noContributors.on( 'click', proxiedToggle );
	};

	ToggleContributorsComponent.prototype.checkContributingDetails = function(){

		if( !this.$someContributors[ 0 ].checked ){

			this.$contributingTeamDetails.hide();
		}
	};

	return ToggleContributorsComponent;

}( jQuery ));	
ew.components.ToggleExportValue = (function( $ ){
	
	function errorMessage( label ){
		return ( label + ' is required for ToggleExportValueComponent' );
	}

	function ToggleExportValueComponent( opts ){

		if( !opts ){ throw new Error( errorMessage( 'opts' ) ); }
		if( !opts.fieldName ){ throw new Error( errorMessage( 'opts.fieldName' ) ); }
		if( !opts.exportValue ){ throw new Error( errorMessage( 'opts.exportValue' ) ); }
		if( !opts.nonExportValue ){ throw new Error( errorMessage( 'opts.nonExportValue' ) ); }
		if( !opts.bothValue ){ throw new Error( errorMessage( 'opts.bothValue' ) ); }
		if( !opts.exportId ){ throw new Error( errorMessage( 'opts.exportId' ) ); }
		if( !opts.nonExportId ){ throw new Error( errorMessage( 'opts.nonExportId' ) ); }

		this.fieldName = opts.fieldName;
		this.exportValue = opts.exportValue;
		this.nonExportValue = opts.nonExportValue;
		this.bothValue = opts.bothValue;

		this.$exportContent = $( '#' + opts.exportId );
		this.$nonExportContent = $( '#' + opts.nonExportId );
		this.$field = $( 'input[ name=' + this.fieldName + ']' );

		this.$field.on( 'change', $.proxy( this.showContent, this ) );

		this.showContent();
	}

	ToggleExportValueComponent.prototype.showContent = function(){
		
		var currentVal = $( 'input[ name=' + this.fieldName + ']:checked' ).val();

		switch( currentVal ){
			case this.exportValue:
				this.$exportContent.show();
				this.$nonExportContent.hide();
			break;

			case this.nonExportValue:
				this.$exportContent.hide();
				this.$nonExportContent.show();
			break;

			case this.bothValue:
				this.$exportContent.show();
				this.$nonExportContent.show();
			break;

			default:
				this.$exportContent.hide();
				this.$nonExportContent.hide();
		}
	};

	return ToggleExportValueComponent;

}( jQuery ));
/*
ew.components.WordCounter = (function( $ ){

	var DANGER_CLASS = 'text-danger';

	function errorMessage( field ){
		return ( field + 'is required for WordCounterComponent' );
	}
	
	function WordCounterComponent( opts ){

		if( !opts ){ throw new Error( errorMessage( 'opts' ) ); }
		if( !opts.limit ){ throw new Error( errorMessage( 'opts.limit' ) ); }
		if( !opts.id ){ throw new Error( errorMessage( 'opts.id' ) ); }

		this.limit = opts.limit;
		this.$input = $( '#' + opts.id );

		this.createCounter();
		this.$input.on( 'keyup', $.proxy( this.upateCharacterCount, this ) );
	}

	WordCounterComponent.prototype.createCounter = function(){
		
		this.$counter = $( '<span class="word-counter">0 characters</span>' );
		this.$counter.insertAfter( this.$input );
		this.upateCharacterCount();
	};

	WordCounterComponent.prototype.upateCharacterCount = function(){

		var val = this.$input.val();
		var count = ( val ? val.length : 0 );
		var text = ( count === 1 ? 'character' : 'characters' );
		
		this.$counter.text( count + ' ' + text );

		if( count > this.limit ){
			
			this.$counter.addClass( DANGER_CLASS ) ;

		} else {

			this.$counter.removeClass( DANGER_CLASS );
		}
	};

	return WordCounterComponent;

}( jQuery ));
*/
ew.pages.confirmationForm = function confirmationFormPage( agreeWithWinName ){
	
	var $infoBox = $( '#confirm-false-info' );
	var $agree = $( 'form input[name='+ agreeWithWinName + ']' );
	var $confirmFalseComments = $( '#confirm-false-details' );

	//hide the comments box on load
	if( !$agree[ 1 ].checked ) {

		$infoBox.hide();
	}

	//Toggle the comments box when the value of the radio changes
	$agree.on( 'change', function( e ){

		if( $agree[ 0 ].checked ){

			$infoBox.hide();

		} else {

			$infoBox.show();
		}
	} );
};
ew.pages.officerForm = (function(){

	var HIDDEN_CLASS = 'hidden';
/*
		window.addEventListener( 'beforeunload', function( e ){

			//console.log( formHasChanges( 'win-form' ) );

			if( formHasChanges( 'win-form' ) ){
				console.log( 'changes made' );
				e.returnValue = 'You have unsaved edits, are you sure you want to leave?';
			} else {
				console.log( 'no changes' );
			}

		} );
*/

	function leadOfficerTeamTypeChange(){

		var selectElem = '#id_hq_team';
		var selectOptions = selectElem + ' option';

		$( '#id_team_type' ).on( 'change', function(){

			var type = $( this ).val();
			var $typeValues;

			if( type ){

				$typeValues = $( '#id_hq_team option[value^=' + type + ']' );

				$( selectOptions ).addClass( HIDDEN_CLASS );
				$typeValues.removeClass( HIDDEN_CLASS );
				$( selectElem ).val( $typeValues.first().val() );

			} else {

				$( selectOptions ).removeClass( HIDDEN_CLASS );
				$( selectElem )[ 0 ].selectedIndex = 0;
			}
		});
	}

	function contributingOfficerTeamTypeChange(){

		$( '.contributing-officer-team-group .contributing-team-type select' ).on( 'change', function(){

			var $teamType = $( this );
			var chosenType = $teamType.val();
			var $team = $teamType.closest( '.row' ).find( '.contributing-team select' );
			var $chosenTeam;

			if( chosenType ){

				$chosenTeam = $team.find( 'option[value^=' + chosenType + ']' );
				$team.val( $chosenTeam.first().val() );
				$team.find( 'option' ).addClass( HIDDEN_CLASS );
				$chosenTeam.removeClass( HIDDEN_CLASS );

			} else {

				$team.find( 'option' ).removeClass( HIDDEN_CLASS );
				$team[ 0 ].selectedIndex = 0;
			}
		});
	}

	function errorMesage( field ){
		return ( field + ' is required for officerFormPage' );
	}

	function createNonCompleteComponents( opts, appComponents ){

		//appComponents.descriptionWordCounter = new ew.components.WordCounter({
		//	id: opts.descriptionId,
		//	limit: 600
		//});

		appComponents.exportValues = new ew.components.ToggleExportValue({
			fieldName: opts.exportType.name,
			exportValue: opts.exportType.exportValue,
			nonExportValue: opts.exportType.nonExportValue,
			bothValue: opts.exportType.bothValue,
			exportId: opts.exportContentId,
			nonExportId: opts.nonExportContentId
		});

		appComponents.calculateExportValue = new ew.components.CalculateExportValue({
			values: opts.exportValues,
			total: opts.exportTotal
		});

		appComponents.calculateNonExportValue = new ew.components.CalculateExportValue({
			values: opts.nonExportValues,
			total: opts.nonExportTotal
		});
	}

	function createComponents( opts, appComponents ){

		appComponents.toggleContributors = new ew.components.ToggleContributors({
			$contributingTeamDetails: $( '#contributing-teams-details' ),
			$someContributors: $( '#some-contributors' ),
			noContributorsSelector: '#no-contributors'
		});

		appComponents.addContributors = new ew.components.AddContributors({
			contributorsSelector: '.contributing-officer-group',
			nameInputSelector: '.contributing-officer-name input'
		});

		//when the details are shown tell addContributors to focus on the first element
		//and tell it to update the remove button position
		appComponents.toggleContributors.events.showDetails.subscribe( function(){

			appComponents.addContributors.focusOnFirstNameInput();
			appComponents.addContributors.updateCloseButton();
		} );
	}

	return function officerFormPage( opts ){

		if( !opts ){ throw new Error( errorMesage( 'opts' ) ); }

		if( typeof opts.complete === 'undefined' ){ throw new Error( errorMesage( 'opts.complete' ) ); }

		if( !opts.complete ){

			if( !opts.descriptionId ){ throw new Error( errorMesage( 'opts.descriptionId' ) ); }

			if( !opts.exportType ){ throw new Error( errorMesage( 'opts.exportType' ) ); }
			if( !opts.exportType.name ){ throw new Error( errorMesage( 'opts.exportType.name' ) ); }
			if( !opts.exportType.exportValue ){ throw new Error( errorMesage( 'opts.exportType.exportValue' ) ); }
			if( !opts.exportType.nonExportValue ){ throw new Error( errorMesage( 'opts.exportType.nonExportValue' ) ); }
			if( !opts.exportType.bothValue ){ throw new Error( errorMesage( 'opts.exportType.bothValue' ) ); }

			if( !opts.exportContentId ){ throw new Error( errorMesage( 'opts.exportContentId' ) ); }
			if( !opts.nonExportContentId ){ throw new Error( errorMesage( 'opts.nonExportContentId' ) ); }

			if( !opts.exportValues || !opts.exportValues.length ){ throw new Error( errorMesage( 'opts.exportValue' ) ); }
			if( !opts.exportTotal ){ throw new Error( errorMesage( 'opts.exportTotal' ) ); }

			if( !opts.nonExportValues || !opts.nonExportValues.length ){ throw new Error( errorMesage( 'opts.nonExportValues' ) ); }
			if( !opts.nonExportTotal ){ throw new Error( errorMesage( 'opts.nonExportTotal' ) ); }
		}
		
		var app = ew.application;
		var appComponents = app.components;

		leadOfficerTeamTypeChange();
		contributingOfficerTeamTypeChange();
		createComponents( opts, appComponents );

		if( !opts.complete ){

			createNonCompleteComponents( opts, appComponents );
		}
	};
}());
//# sourceMappingURL=main.js.map